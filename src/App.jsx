import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Home, Gift, ShoppingBag, User, Search, MapPin, ChevronRight, Flame, Plus, Minus,
  ArrowLeft, CreditCard, Banknote, Store, Bike, Check, LogOut, Settings,
  Trash2, Navigation, ChevronDown, Sparkles, RefreshCw, X, MapPinned, Pencil, Clock3
} from 'lucide-react'
import { fallbackCategories, fallbackProducts, branches as fallbackBranches } from './data'
import { supabase, supabaseConfigured } from './supabase'
import { AdminGate, AdminPanel } from './pages/AdminPanel.jsx'
import { KitchenGate, KitchenMode } from './pages/KitchenMode.jsx'

const money = n => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
const clientStatus = (status,fulfillment='delivery') => status === 'delivered' ? 'Entregado' : status === 'cancelled' ? 'Cancelado' : fulfillment==='pickup' && ['ready','on_the_way'].includes(status) ? 'Listo para recoger' : status === 'on_the_way' ? 'En camino' : 'Preparando'
const emptyAddress = { label:'Casa', street:'', exterior_number:'', interior_number:'', neighborhood:'', postal_code:'', branch_id:'zakia', notes:'' }

function usePersistedState(key, initial) {
  const [state, setState] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  return [state, setState]
}

function useAuth(){
  const [session,setSession]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(supabaseConfigured)
  const loadProfile=async user=>{
    if(!supabase || !user){setProfile(null);return}
    const {data}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
    setProfile(data || null)
  }
  useEffect(()=>{
    if(!supabase){setLoading(false);return}
    supabase.auth.getSession().then(async ({data})=>{setSession(data.session);await loadProfile(data.session?.user);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async (_event,next)=>{setSession(next);await loadProfile(next?.user);setLoading(false)})
    return ()=>subscription.unsubscribe()
  },[])
  return {session,user:session?.user||null,profile,setProfile,loading,refreshProfile:()=>loadProfile(session?.user)}
}

function useCatalog(){
  const [products,setProducts]=useState(fallbackProducts.map((p,i)=>({...p,id:p.slug,sort_order:(i+1)*10,available:true})))
  const [categories,setCategories]=useState(fallbackCategories.filter(c=>c!=='Favoritos'))
  const [categoryObjects,setCategoryObjects]=useState(fallbackCategories.filter(c=>c!=='Favoritos').map((name,i)=>({id:name, name, slug:name.toLowerCase().replace(/\s+/g,'-'), parent_id:null, sort_order:(i+1)*10})))
  const [branches,setBranches]=useState(fallbackBranches)
  const [settings,setSettings]=useState({minimum_order:200,points_reward_cost:250,points_reward_product_id:null})
  const [loading,setLoading]=useState(supabaseConfigured)
  const refresh=async()=>{
    if(!supabase){setLoading(false);return}
    setLoading(true)
    const [{data:p,error:pe},{data:c},{data:b},{data:s}]=await Promise.all([
      supabase.from('products').select('*, category:categories!products_category_id_fkey(id,name,slug), subcategory:categories!products_subcategory_id_fkey(id,name,slug,parent_id,sort_order), product_branch_availability(branch_id,available), product_customizations(sort_order, customization_templates(id,name,input_type,required,min_select,max_select,options, customization_option_branch_availability(option_id,branch_id,available)))').order('sort_order'),
      supabase.from('categories').select('*').eq('active',true).order('sort_order'),
      supabase.from('branches').select('*').eq('active',true),
      supabase.from('app_settings').select('*').eq('id','main').maybeSingle()
    ])
    if(!pe && p?.length) setProducts(p.map(x=>({...x,price:Number(x.price),category:x.category?.name||'Otros',categorySlug:x.category?.slug||'',subcategory:x.subcategory?.name||null,subcategorySlug:x.subcategory?.slug||null,desc:x.description,image:x.image_url||'/assets/kyo-logo.jpg',branchAvailability:Object.fromEntries((x.product_branch_availability||[]).map(r=>[r.branch_id,r.available])),customizations:(x.product_customizations||[]).sort((a,b)=>a.sort_order-b.sort_order).map(pc=>{const t=pc.customization_templates;if(!t)return null;const rows=t.customization_option_branch_availability||[];return {...t,sort_order:pc.sort_order,options:(t.options||[]).map(o=>({...o,branchAvailability:Object.fromEntries(rows.filter(r=>r.option_id===o.id).map(r=>[r.branch_id,r.available]))}))}}).filter(Boolean)})))
    if(c?.length){setCategoryObjects(c);setCategories(c.filter(x=>!x.parent_id).map(x=>x.name))}
    if(b?.length) setBranches(b.map(x=>({id:x.id,name:x.name,short:x.short_name,address:x.address,phone:x.phone,eta:x.eta})))
    if(s) setSettings({minimum_order:Number(s.minimum_order||200),points_reward_cost:Number(s.points_reward_cost||250),points_reward_product_id:s.points_reward_product_id||null})
    setLoading(false)
  }
  useEffect(()=>{refresh()},[])
  return {products,categories,categoryObjects,branches,settings,loading,refresh,setProducts}
}

function useAddresses(auth){
  const [addresses,setAddresses]=useState([])
  const [loading,setLoading]=useState(false)
  const refresh=async()=>{
    if(!supabase||!auth.user){setAddresses([]);return}
    setLoading(true)
    const {data}=await supabase.from('addresses').select('*').eq('user_id',auth.user.id).order('is_default',{ascending:false}).order('created_at')
    setAddresses(data||[]);setLoading(false)
  }
  useEffect(()=>{refresh()},[auth.user?.id])
  return {addresses,setAddresses,loading,refresh}
}

function App(){
  const auth=useAuth()
  const catalog=useCatalog()
  const addressBook=useAddresses(auth)
  const [cart,setCart]=usePersistedState('kyo-cart-v3',[])
  const [configuring,setConfiguring]=useState(null)
  const [destination,setDestination]=usePersistedState('kyo-destination-v1',{mode:'pickup',branchId:'zakia',addressId:null})
  const cartCount=cart.reduce((a,i)=>a+i.qty,0)
  const cartTotal=cart.reduce((a,i)=>a+Number(i.price)*i.qty,0)
  const selectedAddress=addressBook.addresses.find(a=>a.id===destination.addressId)||null
  const branchId=destination.mode==='delivery' && selectedAddress ? selectedAddress.branch_id : destination.branchId
  const branch=catalog.branches.find(b=>b.id===branchId)||catalog.branches[0]||fallbackBranches[0]

  useEffect(()=>{
    if(auth.user && addressBook.addresses.length && destination.mode==='delivery' && !selectedAddress){
      const a=addressBook.addresses[0]
      setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id})
    }
  },[auth.user?.id,addressBook.addresses.length])

  const add=p=>setConfiguring(p)
  const addConfigured=item=>{setCart(prev=>[...prev,{...item,cartLineId:crypto.randomUUID(),qty:1}]);setConfiguring(null)}
  const update=async(id,delta)=>{
    const item=cart.find(i=>(i.cartLineId||i.id)===id)
    if(item?.reward && delta<0){
      if(item.rewardVoucherId&&supabase){
        const {error}=await supabase.rpc('cancel_reward_voucher',{p_voucher_id:item.rewardVoucherId})
        if(error){console.error(error);return alert('No pudimos devolver tu reward. Intenta nuevamente.')}
        await auth.refreshProfile()
      }
      setCart(prev=>prev.filter(i=>(i.cartLineId||i.id)!==id))
      return
    }
    setCart(prev=>prev.map(i=>(i.cartLineId||i.id)===id?{...i,qty:i.qty+delta}:i).filter(i=>i.qty>0))
  }
  const panelHost=typeof window!=='undefined'&&window.location.hostname.startsWith('panel.')
  if(panelHost&&window.location.pathname==='/') return <Navigate to="/panel" replace/>

  const shared={auth,catalog,addressBook,destination,setDestination,selectedAddress,branch}
  return <div className="app-shell">
    <Routes>
      <Route path="/" element={<HomePage {...shared} add={add} cartCount={cartCount}/>}/>
      <Route path="/menu" element={<MenuPage {...shared} add={add} cartCount={cartCount} cartTotal={cartTotal}/>}/>
      <Route path="/rewards" element={<RewardsPage {...shared} cart={cart} setCart={setCart}/>}/>
      <Route path="/orders" element={<OrdersPage {...shared}/>}/>
      <Route path="/profile" element={<ProfilePage {...shared}/>}/>
      <Route path="/login" element={<LoginPage auth={auth}/>}/>
      <Route path="/cart" element={<CartPage cart={cart} update={update} total={cartTotal} destination={destination} selectedAddress={selectedAddress} branch={branch} catalog={catalog}/>}/>
      <Route path="/checkout" element={<CheckoutPage cart={cart} total={cartTotal} setCart={setCart} {...shared}/>}/>
      <Route path="/success" element={<SuccessPage/>}/>
      <Route path="/panel" element={<AdminGate auth={auth}><AdminPanel auth={auth} catalog={catalog}/></AdminGate>}/>
      <Route path="/modococina" element={<KitchenGate auth={auth}><KitchenMode auth={auth}/></KitchenGate>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
    {configuring&&<ProductCustomizeModal product={configuring} branchId={branchId} onClose={()=>setConfiguring(null)} onAdd={addConfigured}/>}
    <BottomNav cartCount={cartCount}/>
  </div>
}

function Brand(){return <div className="brand"><img className="brand-logo-img" src="/assets/logo.png?v=3" alt="KYO Sushi"/></div>}

function formatAddress(a){
  if(!a)return ''
  return `${a.street || a.address_line || ''}${a.exterior_number?` #${a.exterior_number}`:''}${a.interior_number?` Int. ${a.interior_number}`:''}${a.neighborhood?`, ${a.neighborhood}`:''}${a.postal_code?`, CP ${a.postal_code}`:''}`
}

function Header({auth,catalog,addressBook,destination,setDestination,selectedAddress,plain=false,hideBrand=false}){
  const [open,setOpen]=useState(false); const [adding,setAdding]=useState(false); const [editingAddress,setEditingAddress]=useState(null); const nav=useNavigate()
  const chooseAddress=a=>{setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id});setOpen(false)}
  const choosePickup=id=>{setDestination({mode:'pickup',addressId:null,branchId:id});setOpen(false)}
  const label=destination?.mode==='delivery'&&selectedAddress ? (selectedAddress.label||'Entrega') : `Recoger en ${catalog?.branches?.find(b=>b.id===destination?.branchId)?.short||'sucursal'}`
  const detail=destination?.mode==='delivery'&&selectedAddress ? formatAddress(selectedAddress) : 'Pickup en sucursal'
  return <>
    <header className={`topbar ${plain?'plain':''} ${hideBrand?'no-brand':''}`}>{!hideBrand&&<Brand/>}{!plain&&<div className="branch-wrap"><button className="branch-btn destination-btn" onClick={()=>setOpen(v=>!v)}><MapPin size={16}/><span><small>Entregar en</small><strong>{label}</strong><em>{detail}</em></span><ChevronDown size={16}/></button>{open&&<div className="branch-menu destination-menu"><div className="destination-title">¿Dónde quieres recibir tu KYO?</div>{auth?.user&&addressBook?.addresses?.map(a=><div className={`destination-address-row ${destination?.addressId===a.id?'active':''}`} key={a.id}><button className="destination-address-main" onClick={()=>chooseAddress(a)}><span><strong>{a.label||'Dirección'} · {a.branch_id==='zakia'?'Zákia':'Milenio'}</strong><small>{formatAddress(a)}</small></span></button><button className="destination-edit" onClick={()=>setEditingAddress(a)} aria-label="Editar dirección"><Pencil size={15}/></button></div>)}<button className="add-location" onClick={()=>auth?.user?setAdding(true):nav('/login')}><Plus size={16}/><span><strong>Agregar otra dirección</strong><small>Guárdala para futuros pedidos</small></span></button><div className="pickup-title">O recoger en sucursal</div>{catalog?.branches?.map(b=><button key={b.id} onClick={()=>choosePickup(b.id)} className={`pickup-option ${destination?.mode==='pickup'&&destination?.branchId===b.id?'active':''}`}><Store size={16}/><span><strong>{b.name}</strong><small>{b.address}</small></span></button>)}</div>}</div>}</header>
    {adding&&<AddressModal auth={auth} branches={catalog.branches} onClose={()=>setAdding(false)} onSaved={async a=>{await addressBook.refresh();setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id});setAdding(false);setOpen(false)}}/>}
    {editingAddress&&<AddressModal auth={auth} branches={catalog.branches} initial={editingAddress} onClose={()=>setEditingAddress(null)} onSaved={async a=>{await addressBook.refresh();if(destination?.addressId===a.id)setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id});setEditingAddress(null)}}/>}
  </>
}

function BottomNav({cartCount}){const loc=useLocation();if(['/login','/checkout','/success','/panel','/modococina'].some(p=>loc.pathname.startsWith(p)))return null;return <nav className="bottom-nav">{[['/',Home,'Inicio'],['/menu',Search,'Menú'],['/rewards',Gift,'Rewards'],['/orders',ShoppingBag,'Pedidos'],['/profile',User,'Perfil']].map(([to,Icon,label])=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>isActive?'active':''}><Icon size={21}/><span>{label}</span>{to==='/orders'&&cartCount>0?<b className="mini-badge">{cartCount}</b>:null}</NavLink>)}</nav>}

function HomePage({auth,catalog,addressBook,destination,setDestination,selectedAddress,add,cartCount}){const nav=useNavigate();const featured=catalog.products.filter(p=>p.featured&&p.available!==false).slice(0,6);const branch=catalog.branches.find(b=>b.id===(selectedAddress?.branch_id||destination.branchId))||catalog.branches[0];return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="hero"><div className="hero-copy"><span className="hero-location-tag">ZÁKIA · MILENIO</span><span className="eyebrow">KYO A TU MANERA</span><h1>Tu sushi favorito,<br/><em>más cerca de ti.</em></h1><p>Pide directo, acumula KYO Points y recibe beneficios exclusivos.</p><button className="primary" onClick={()=>nav('/menu')}>Ordenar ahora <ChevronRight size={18}/></button></div><div className="hero-art"><div className="red-orb"></div><img src="/assets/menu/ebi-crispy-ramen.jpg" alt="Ramen KYO"/></div></section><section className="quick-row"><div><Bike/><span><strong>Delivery</strong><small>{branch?.eta||'35–50 min'}</small></span></div><div><Store/><span><strong>Pickup</strong><small>Listo en 20–30 min</small></span></div><div><Gift/><span><strong>Rewards</strong><small>1 punto por $1</small></span></div></section><section className="section"><div className="section-head"><div><span className="eyebrow dark">LOS MÁS PEDIDOS</span><h2>Favoritos de KYO</h2></div><button className="text-btn" onClick={()=>nav('/menu')}>Ver todo <ChevronRight size={17}/></button></div><div className="product-scroller">{featured.map(p=><ProductCard key={p.id} p={p} add={add} branchId={branch?.id}/>)}</div></section><section className="reward-banner"><div><span className="reward-icon"><Sparkles/></span><span><small>KYO REWARDS</small><strong>Come rico. Gana puntos.<br/>Recibe más KYO.</strong></span></div><button onClick={()=>nav('/rewards')}>Ver mis beneficios</button></section>{cartCount>0&&<button className="floating-cart" onClick={()=>nav('/cart')}><ShoppingBag size={20}/><span>Ver carrito</span><b>{cartCount}</b></button>}</main>}

function productDisplayPrice(p){
  const base=Number(p.price||0)
  if(base>0) return money(base)
  const required=(p.customizations||[]).filter(t=>t.required)
  if(!required.length) return money(base)
  let extra=0
  for(const t of required){
    const prices=(t.options||[]).map(o=>Number(o.price||0)).sort((a,b)=>a-b)
    if(!prices.length) continue
    if(t.input_type==='single') extra+=prices[0]
    else {
      const min=Math.max(1,Number(t.min_select||1))
      extra+=prices.slice(0,min).reduce((a,b)=>a+b,0)
    }
  }
  return extra>0?`Desde ${money(extra)}`:money(base)
}

function ProductCard({p,add,branchId}){const branchUnavailable=branchId&&p.branchAvailability?.[branchId]===false;return <article className={`product-card ${branchUnavailable?'branch-unavailable':''}`}><div className="product-img"><img src={p.image||p.image_url} alt={p.name}/>{p.spicy&&<span className="spicy"><Flame size={13}/> Spicy</span>}{branchUnavailable&&<span className="branch-soldout">No disponible aquí</span>}</div><div className="product-body"><small>{p.category}</small><h3>{p.name}</h3><p>{p.desc||p.description}</p><div><strong>{productDisplayPrice(p)}</strong><button className="add-btn" disabled={branchUnavailable} onClick={()=>!branchUnavailable&&add(p)} aria-label={`Agregar ${p.name}`}><Plus/></button></div></div></article>}

function MenuPage(props){
  const {auth,catalog,addressBook,destination,setDestination,selectedAddress,add,cartCount,branch}=props
  const nav=useNavigate();const [params]=useSearchParams();const [cat,setCat]=useState(params.get('category')||'Favoritos');const [subcat,setSubcat]=useState('Todos');const [q,setQ]=useState('')
  const categoryList=['Favoritos',...catalog.categories]
  const activeCategory=catalog.categoryObjects?.find(c=>!c.parent_id&&c.name===cat)
  const subcategories=(catalog.categoryObjects||[]).filter(c=>activeCategory&&c.parent_id===activeCategory.id).sort((a,b)=>a.sort_order-b.sort_order)
  useEffect(()=>{setSubcat('Todos')},[cat])
  const shown=useMemo(()=>catalog.products.filter(p=>p.available!==false).filter(p=>cat==='Favoritos'?p.featured:p.category===cat).filter(p=>subcat==='Todos'||p.subcategory===subcat).filter(p=>(p.name+' '+(p.desc||'')).toLowerCase().includes(q.toLowerCase())),[catalog.products,cat,subcat,q])
  return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="menu-head"><span className="eyebrow dark">MENÚ KYO</span><h1>¿Qué se te antoja?</h1><div className="search-box"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar ramen, rollos, entradas..."/></div></section><div className="cat-tabs">{categoryList.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>{subcategories.length>0&&<div className="subcat-tabs"><button className={subcat==='Todos'?'active':''} onClick={()=>setSubcat('Todos')}>Todos</button>{subcategories.map(s=><button key={s.id} className={subcat===s.name?'active':''} onClick={()=>setSubcat(s.name)}>{s.name}</button>)}</div>}{catalog.loading?<div className="loading-state"><RefreshCw className="spin"/> Cargando menú...</div>:<section className="menu-grid">{shown.map(p=><ProductCard key={p.id} p={p} add={add} branchId={branch?.id}/>)}</section>}{shown.length===0&&!catalog.loading&&<EmptyState icon={<Search/>} title="No encontramos productos" text="Prueba otra categoría o búsqueda." button="Ver favoritos" onClick={()=>setCat('Favoritos')}/>} {cartCount>0&&<button className="floating-cart" onClick={()=>nav('/cart')}><ShoppingBag size={20}/><span>Ver carrito</span><b>{cartCount}</b></button>}</main>
}
function ProductCustomizeModal({product,branchId,onClose,onAdd,rewardFree=false,actionLabel='Agregar al carrito'}){
  const templates=product.customizations||[]
  const [selected,setSelected]=useState({})
  const [note,setNote]=useState('')
  const [error,setError]=useState('')
  const choose=(t,opt)=>{if(branchId&&opt.branchAvailability?.[branchId]===false)return;setSelected(prev=>{
    const current=prev[t.id]||{}
    if(t.input_type==='single') return {...prev,[t.id]:{[opt.id]:1}}
    if(t.input_type==='multiple') return {...prev,[t.id]:{...current,[opt.id]:current[opt.id]?0:1}}
    return prev
  })}
  const qty=(t,opt,delta)=>{if(branchId&&opt.branchAvailability?.[branchId]===false)return;setSelected(prev=>{const current=prev[t.id]||{};return {...prev,[t.id]:{...current,[opt.id]:Math.max(0,Math.min(20,(current[opt.id]||0)+delta))}}})}
  const finish=()=>{
    const rows=[]
    for(const t of templates){
      const values=selected[t.id]||{}
      const count=Object.values(values).reduce((a,n)=>a+Number(n||0),0)
      const chosenCount=Object.values(values).filter(n=>Number(n)>0).length
      if(t.required && count<(t.min_select||1)){setError(`Completa: ${t.name}`);return}
      if(t.max_select && (t.input_type==='quantity'?count:chosenCount)>t.max_select){setError(`Máximo ${t.max_select} en ${t.name}`);return}
      for(const opt of (t.options||[])){
        const q=Number(values[opt.id]||0); if(!q)continue
        if(branchId&&opt.branchAvailability?.[branchId]===false){setError(`${opt.name} no está disponible en esta sucursal`);return}
        rows.push({template_id:t.id,template_name:t.name,option_id:opt.id,label:t.input_type==='quantity'?`${q}× ${opt.name}`:opt.name,quantity:q,price:rewardFree?0:Number(opt.price||0)*q})
      }
    }
    const extras=rows.reduce((a,r)=>a+r.price,0)
    onAdd({...product,basePrice:Number(product.price),price:rewardFree?0:Number(product.price)+extras,selectedCustomizations:rows,itemNote:note.trim(),rewardFreeCustomizations:rewardFree})
  }
  return <div className="modal-backdrop product-config-backdrop"><div className="product-config-modal"><div className="modal-head"><div><small>PERSONALIZA TU PEDIDO</small><h2>{product.name}</h2></div><button onClick={onClose}><X/></button></div><div className="config-product-head"><img src={product.image||product.image_url}/><div><p>{product.desc||product.description}</p><strong>{rewardFree?'GRATIS':productDisplayPrice(product)}</strong></div></div>{templates.map(t=><section className="config-group" key={t.id}><div className="config-group-title"><div><h3>{t.name}</h3><small>{t.required?'Obligatorio':'Opcional'} · {t.input_type==='single'?'Elige una':t.input_type==='multiple'?`Marca hasta ${t.max_select||'varias'}`:'Elige cantidades'}</small></div>{t.required&&<b>REQUERIDO</b>}</div><div className="config-options">{(t.options||[]).map(opt=>{const n=selected[t.id]?.[opt.id]||0;const unavailable=branchId&&opt.branchAvailability?.[branchId]===false;return <div className={`config-option ${n?'selected':''} ${unavailable?'option-unavailable':''}`} key={opt.id}><span><strong>{opt.name}</strong><small>{unavailable?'No disponible en esta sucursal':rewardFree?'Incluido gratis':Number(opt.price)>0?(Number(product.price||0)===0&&t.required?money(opt.price):`+ ${money(opt.price)}`):'Sin costo'}</small></span>{t.input_type==='quantity'?<div className="config-qty"><button disabled={unavailable} onClick={()=>qty(t,opt,-1)}><Minus size={15}/></button><b>{n}</b><button disabled={unavailable} onClick={()=>qty(t,opt,1)}><Plus size={15}/></button></div>:<button disabled={unavailable} className="config-check" onClick={()=>choose(t,opt)}>{n?<Check size={16}/>:null}</button>}</div>})}</div></section>)}<label className="product-note"><span>Nota para este producto <small>(opcional)</small></span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej. Sin cebollín, salsa aparte..." maxLength={250}/></label>{error&&<div className="form-message">{error}</div>}<div className="product-config-footer"><button className="primary full" onClick={finish}>{actionLabel}</button></div></div></div>
}

const phoneCountries=[
  {code:'+52',flag:'🇲🇽',name:'México'},
  {code:'+1',flag:'🇺🇸',name:'Estados Unidos / Canadá'},
  {code:'+34',flag:'🇪🇸',name:'España'},
  {code:'+54',flag:'🇦🇷',name:'Argentina'},
  {code:'+57',flag:'🇨🇴',name:'Colombia'},
  {code:'+56',flag:'🇨🇱',name:'Chile'},
  {code:'+51',flag:'🇵🇪',name:'Perú'}
]

function LoginPage({auth}){
  const nav=useNavigate()
  const [mode,setMode]=useState('login')
  const [name,setName]=useState('')
  const [countryCode,setCountryCode]=useState('+52')
  const [phone,setPhone]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{if(auth.user)nav('/',{replace:true})},[auth.user])

  const submit=async e=>{
    e.preventDefault();setError('')
    if(!supabase){setError('Falta configurar Supabase.');return}
    if(mode==='register'){
      if(phone.length!==10){setError('Tu número de teléfono debe tener exactamente 10 dígitos.');return}
      if(password!==confirmPassword){setError('Las contraseñas no coinciden.');return}
    }
    setBusy(true)
    const result=mode==='register'
      ?await supabase.auth.signUp({
        email,password,
        options:{data:{full_name:name,phone:`${countryCode}${phone}`,phone_country_code:countryCode}}
      })
      :await supabase.auth.signInWithPassword({email,password})
    setBusy(false)
    if(result.error){setError(result.error.message);return}
    if(mode==='register'&&!result.data.session){setError('Cuenta creada. Revisa tu correo para confirmar el acceso.');return}
    nav('/')
  }

  return <main className="auth-page">
    <button className="back" onClick={()=>nav(-1)}><ArrowLeft/></button>
    <div className="auth-brand"><Brand/><p>Tu KYO. Tus rewards. Tu pedido.</p></div>
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-tabs">
        <button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Iniciar sesión</button>
        <button type="button" className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Crear cuenta</button>
      </div>
      {mode==='register'&&<>
        <label>Nombre<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label>
        <label>Número de teléfono
          <div className="phone-register-field">
            <select aria-label="Código de país" value={countryCode} onChange={e=>setCountryCode(e.target.value)}>
              {phoneCountries.map(c=><option key={`${c.code}-${c.name}`} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input
              required
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              pattern="[0-9]{10}"
              minLength="10"
              maxLength="10"
              value={phone}
              onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
              placeholder="4421234567"
            />
          </div>
          <small className={`phone-digit-count ${phone.length===10?'complete':''}`}>{phone.length}/10 dígitos</small>
        </label>
      </>}
      <label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
      <label>Contraseña<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
      {mode==='register'&&<label>Confirmar contraseña<input type="password" minLength="6" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••••"/></label>}
      {error&&<div className="form-message">{error}</div>}
      <button disabled={busy} className="primary full">{busy?'Procesando...':mode==='login'?'Entrar a mi cuenta':'Crear mi cuenta'}</button>
    </form>
  </main>
}
function AddressModal({auth,branches,onClose,onSaved,initial=null}){const [form,setForm]=useState(initial?{...emptyAddress,...initial}:{...emptyAddress});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const save=async e=>{e.preventDefault();if(!supabase||!auth.user)return;setBusy(true);setError('');const payload={user_id:auth.user.id,label:form.label||'Casa',street:form.street,exterior_number:form.exterior_number,interior_number:form.interior_number||null,neighborhood:form.neighborhood,postal_code:form.postal_code,branch_id:form.branch_id,notes:form.notes||null,address_line:formatAddress(form)};const result=initial?.id?await supabase.from('addresses').update(payload).eq('id',initial.id).select().single():await supabase.from('addresses').insert(payload).select().single();setBusy(false);if(result.error){setError(result.error.message);return}onSaved(result.data)};return <div className="modal-backdrop"><form className="address-editor" onSubmit={save}><div className="modal-head"><div><small>{initial?'EDITAR DIRECCIÓN':'NUEVA DIRECCIÓN'}</small><h2>{initial?'Edita tu dirección':'¿Dónde entregamos?'}</h2></div><button type="button" onClick={onClose}><X/></button></div><div className="address-form-grid"><label className="admin-field full-span"><span>Nombre de la dirección</span><input value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="Casa, Oficina..."/></label><label className="admin-field full-span"><span>Dirección / calle</span><input required value={form.street} onChange={e=>setForm({...form,street:e.target.value})} placeholder="Av. Paseo de..."/></label><label className="admin-field"><span>Número exterior</span><input required value={form.exterior_number} onChange={e=>setForm({...form,exterior_number:e.target.value})}/></label><label className="admin-field"><span>Número interior</span><input value={form.interior_number||''} onChange={e=>setForm({...form,interior_number:e.target.value})} placeholder="Opcional"/></label><label className="admin-field"><span>Colonia</span><input required value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})}/></label><label className="admin-field"><span>Código postal</span><input required inputMode="numeric" value={form.postal_code} onChange={e=>setForm({...form,postal_code:e.target.value})}/></label><label className="admin-field full-span"><span>Sucursal que atenderá esta dirección</span><select value={form.branch_id} onChange={e=>setForm({...form,branch_id:e.target.value})}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="admin-field full-span"><span>Detalles o referencias</span><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Portón negro, frente al parque, tocar timbre..."/></label></div>{error&&<div className="form-message">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando...':'Guardar dirección'}</button></div></form></div>}

function ProfilePage({auth,addressBook,catalog,destination,setDestination,selectedAddress}){
  const nav=useNavigate(); const [showAddresses,setShowAddresses]=useState(false); const [adding,setAdding]=useState(false); const [editing,setEditing]=useState(null)
  if(!auth.user)return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="page-intro"><span className="eyebrow dark">MI KYO</span><h1>Tu cuenta KYO</h1><p>Inicia sesión para guardar direcciones, ver pedidos y acumular rewards.</p><button className="primary dark-btn" onClick={()=>nav('/login')}>Iniciar sesión</button></section><GuestBenefits/></main>
  return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="profile-hero"><div className="avatar">{(auth.profile?.full_name||auth.user.email||'K')[0].toUpperCase()}</div><div><small>HOLA,</small><h1>{auth.profile?.full_name||'Cliente KYO'}</h1><p>{auth.user.email}</p></div></section><section className="profile-stats"><div><strong>{auth.profile?.reward_points||0}</strong><small>KYO Points</small></div><div><strong>{addressBook.addresses.length}</strong><small>Direcciones</small></div></section><section className="profile-menu"><button onClick={()=>setShowAddresses(v=>!v)}><span><MapPin/> Mis direcciones <small className="profile-count">{addressBook.addresses.length}</small></span><ChevronRight className={showAddresses?'rotate':''}/></button>{showAddresses&&<div className="profile-address-panel"><div className="profile-address-head"><div><small>DIRECCIONES GUARDADAS</small><strong>Elige, edita o agrega una dirección</strong></div><button className="text-btn" onClick={()=>setAdding(true)}><Plus size={16}/> Agregar</button></div><div className="address-list">{addressBook.addresses.map(a=><div className="address-option" key={a.id}><MapPin/><span><strong>{a.label} · {a.branch_id==='zakia'?'Zákia':'Milenio'}</strong><small>{formatAddress(a)}</small>{a.notes&&<em>{a.notes}</em>}</span><div className="address-actions"><button onClick={()=>setEditing(a)} title="Editar"><Pencil size={16}/></button><button onClick={async()=>{await supabase.from('addresses').delete().eq('id',a.id);addressBook.refresh()}} title="Eliminar"><Trash2 size={16}/></button></div></div>)}{!addressBook.addresses.length&&<button className="save-login" onClick={()=>setAdding(true)}>+ Agregar mi primera dirección</button>}</div></div>}<button><span><Settings/> Preferencias</span><ChevronRight/></button><button className="logout" onClick={()=>supabase.auth.signOut()}><span><LogOut/> Cerrar sesión</span></button></section>{adding&&<AddressModal auth={auth} branches={catalog.branches} onClose={()=>setAdding(false)} onSaved={async()=>{await addressBook.refresh();setAdding(false)}}/>}{editing&&<AddressModal auth={auth} branches={catalog.branches} initial={editing} onClose={()=>setEditing(null)} onSaved={async()=>{await addressBook.refresh();setEditing(null)}}/>}</main>
}

function GuestBenefits(){return <section className="section"><div className="benefit-boxes"><div><Gift/><strong>Rewards exclusivos</strong><p>Acumula puntos en pedidos entregados.</p></div><div><MapPin/><strong>Direcciones guardadas</strong><p>Pide en menos pasos la próxima vez.</p></div><div><ShoppingBag/><strong>Historial completo</strong><p>Consulta todos tus pedidos.</p></div></div></section>}

function RewardsPage({auth,catalog,addressBook,destination,setDestination,selectedAddress,branch,cart,setCart}){
  const nav=useNavigate()
  const [busy,setBusy]=useState('')
  const [msg,setMsg]=useState('')
  const [chooseRoll,setChooseRoll]=useState(false)
  const [configRoll,setConfigRoll]=useState(null)

  const rewardVoucherIds=(cart||[]).filter(i=>i.rewardVoucherId).map(i=>i.rewardVoucherId)
  const hasSpringInCart=(cart||[]).some(i=>i.rewardType==='spring_rolls')
  const hasFreeRollInCart=(cart||[]).some(i=>i.rewardType==='free_roll')

  useEffect(()=>{
    if(!supabase||!auth.user)return
    let alive=true
    ;(async()=>{
      const {data}=await supabase.from('reward_vouchers').select('id').eq('user_id',auth.user.id).eq('status','available')
      const orphaned=(data||[]).filter(v=>!rewardVoucherIds.includes(v.id))
      for(const v of orphaned) await supabase.rpc('cancel_reward_voucher',{p_voucher_id:v.id})
      if(alive&&orphaned.length)await auth.refreshProfile()
    })()
    return()=>{alive=false}
  },[auth.user?.id,rewardVoucherIds.join('|')])

  if(!auth.user)return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><EmptyState icon={<Gift/>} title="Tus rewards viven aquí" text="Inicia sesión para acumular KYO Points." button="Iniciar sesión" onClick={()=>nav('/login')}/></main>

  const points=auth.profile?.reward_points||0
  const stamps=Math.min(6,auth.profile?.reward_order_stamps||0)
  const branchId=branch?.id
  const pointsRewardCost=Number(catalog.settings?.points_reward_cost||250)
  const pointsRewardProduct=catalog.products.find(p=>p.id===catalog.settings?.points_reward_product_id && p.available!==false && (!branchId||p.branchAvailability?.[branchId]!==false))
  const classicRolls=catalog.products.filter(p=>
    p.available!==false &&
    (p.subcategorySlug==='clasicos'||p.subcategory?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')==='clasicos') &&
    (!branchId||p.branchAvailability?.[branchId]!==false)
  )

  const reserveSpring=async()=>{
    setBusy('spring_rolls');setMsg('')
    const {data,error}=await supabase.rpc('redeem_spring_rolls_reward')
    setBusy('')
    if(error){setMsg(error.message);return}
    const voucherId=Array.isArray(data)?data[0]:data
    if(!pointsRewardProduct){
      await supabase.rpc('cancel_reward_voucher',{p_voucher_id:voucherId})
      await auth.refreshProfile()
      return setMsg('El producto configurado para este reward no está disponible en esta sucursal.')
    }
    setCart(prev=>[
      ...prev,
      {...pointsRewardProduct,id:`reward-${voucherId}`,productId:pointsRewardProduct.id,price:0,qty:1,reward:true,rewardType:'spring_rolls',rewardVoucherId:voucherId,name:pointsRewardProduct.name,desc:`KYO Rewards · ${pointsRewardCost} puntos`}
    ])
    await auth.refreshProfile()
    nav('/cart')
  }

  const startSixOrderReward=()=>{
    setMsg('')
    if(stamps<6)return
    if(!classicRolls.length)return setMsg('No hay rollos clásicos disponibles en esta sucursal por el momento.')
    setChooseRoll(true)
  }

  const finishFreeRoll=async(configured)=>{
    setBusy('six_orders');setMsg('')
    const {data,error}=await supabase.rpc('redeem_six_orders_reward')
    setBusy('')
    if(error){setMsg(error.message);return}
    const voucherId=Array.isArray(data)?data[0]:data
    setCart(prev=>[
      ...prev,
      {...configured,id:`reward-${voucherId}`,productId:configured.id,price:0,qty:1,reward:true,rewardType:'free_roll',rewardVoucherId:voucherId,name:configured.name,desc:'Reto KYO · 6 pedidos · personalizaciones incluidas'}
    ])
    await auth.refreshProfile()
    setConfigRoll(null);setChooseRoll(false)
    nav('/cart')
  }

  return <main>
    <Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/>
    <section className="page-intro rewards-intro"><span className="eyebrow dark">KYO REWARDS</span><h1>{points} puntos</h1><p>Ganas 1 punto por cada $1 de subtotal cuando tu pedido se marca como entregado.</p></section>
    <section className="reward-banner rewards-balance"><div><span className="reward-icon"><Gift/></span><span><small>TU SALDO</small><strong>{points} KYO Points</strong></span></div></section>
    <section className="section reward-benefits">
      <div className="section-head"><div><span className="eyebrow dark">TUS BENEFICIOS</span><h2>Canjea y disfruta</h2></div></div>
      <div className="reward-grid">
        <article className="reward-card points-reward-card">
          <div className="reward-card-icon"><Gift/></div>
          <div className="reward-card-copy"><small>BENEFICIO POR PUNTOS</small><h3>{pointsRewardProduct?.name||'Reward por puntos'}</h3><p>Canjéalo por <strong>{pointsRewardCost} puntos</strong>. Se agrega directamente a tu carrito en $0.</p></div>
          <button className="primary" disabled={points<pointsRewardCost||busy==='spring_rolls'||!pointsRewardProduct||hasSpringInCart} onClick={reserveSpring}>{hasSpringInCart?'Ya está en tu carrito':busy==='spring_rolls'?'Canjeando...':!pointsRewardProduct?'Reward no disponible':points>=pointsRewardCost?'Canjear y agregar al carrito':`Te faltan ${pointsRewardCost-points} puntos`}</button>
        </article>
        <article className="reward-card stamp-card">
          <div><small>RETO KYO</small><h3>Tu 6.º pedido invita el rollo</h3><p>Completa 6 pedidos entregados y elige <strong>cualquier rollo de Clásicos</strong>. Sus personalizaciones van incluidas.</p></div>
          <div className="stamp-row">{Array.from({length:6},(_,i)=><span key={i} className={i<stamps?'done':''}>{i<stamps?<Check size={16}/>:i+1}</span>)}</div>
          <div className="stamp-progress"><strong>{stamps}/6 pedidos</strong><small>{stamps>=6?'¡Ya puedes elegir tu rollo!':`Te faltan ${6-stamps} pedidos`}</small></div>
          <button className="primary dark-btn" disabled={stamps<6||busy==='six_orders'||hasFreeRollInCart} onClick={startSixOrderReward}>{hasFreeRollInCart?'Ya está en tu carrito':stamps>=6?'Elegir mi rollo gratis':'Sigue acumulando'}</button>
        </article>
      </div>
      {msg&&<div className="reward-message">{msg}</div>}
    </section>

    {chooseRoll&&!configRoll&&<div className="modal-backdrop"><div className="reward-roll-picker">
      <div className="modal-head"><div><small>RETO KYO · 6 PEDIDOS</small><h2>Elige tu rollo gratis</h2><p>Selecciona cualquiera de los rollos de Clásicos disponibles en {branch?.name||'tu sucursal'}.</p></div><button onClick={()=>setChooseRoll(false)}><X/></button></div>
      <div className="reward-roll-grid">{classicRolls.map(p=><button key={p.id} className="reward-roll-option" onClick={()=>setConfigRoll(p)}><img src={p.image||p.image_url}/><span><small>{p.subcategory||'Clásicos'}</small><strong>{p.name}</strong><em>{productDisplayPrice(p)} · GRATIS con tu reward</em></span><ChevronRight/></button>)}</div>
    </div></div>}

    {configRoll&&<ProductCustomizeModal product={configRoll} branchId={branchId} rewardFree actionLabel={busy==='six_orders'?'Canjeando...':'Agregar rollo GRATIS al carrito'} onClose={()=>setConfigRoll(null)} onAdd={finishFreeRoll}/>}
  </main>
}
function OrdersPage({auth,catalog,addressBook,destination,setDestination,selectedAddress}){const nav=useNavigate();const [orders,setOrders]=useState([]);const [loading,setLoading]=useState(true);const load=async()=>{if(!supabase||!auth.user){setLoading(false);return}const {data}=await supabase.from('orders').select('*, order_items(*)').eq('user_id',auth.user.id).order('created_at',{ascending:false});setOrders(data||[]);setLoading(false)};useEffect(()=>{load();if(!supabase||!auth.user)return;const ch=supabase.channel(`client-orders-${auth.user.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:`user_id=eq.${auth.user.id}`},load).subscribe();return()=>supabase.removeChannel(ch)},[auth.user?.id]);if(!auth.user)return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><EmptyState icon={<ShoppingBag/>} title="Tus pedidos en un solo lugar" text="Inicia sesión para ver tu historial y seguimiento." button="Iniciar sesión" onClick={()=>nav('/login')}/></main>;const active=orders.filter(o=>!['delivered','cancelled'].includes(o.status));const history=orders.filter(o=>['delivered','cancelled'].includes(o.status));return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="page-intro compact"><span className="eyebrow dark">MIS PEDIDOS</span><h1>Tu pedido</h1></section>{loading?<div className="loading-state"><RefreshCw className="spin"/> Cargando...</div>:<section className="orders"><div className="orders-group-title">PEDIDO ACTUAL</div>{active.map(o=><OrderCard key={o.id} o={o} active/>)}{active.length===0&&<div className="no-active-order"><ShoppingBag/><div><strong>No tienes un pedido en curso</strong><small>Cuando hagas uno, podrás seguirlo aquí.</small></div><button className="primary" onClick={()=>nav('/menu')}>Hacer pedido</button></div>}{history.length>0&&<><div className="orders-group-title history-title">ANTERIORES</div>{history.map(o=><OrderCard key={o.id} o={o}/>)}</>}</section>}</main>}
function OrderCard({o,active}){const state=clientStatus(o.status,o.fulfillment_type);return <article className={active?'active-order-card':''}><div><span className={`status ${o.status==='delivered'?'completed':''}`}><Check size={15}/> {state}</span><small>{new Date(o.created_at).toLocaleString('es-MX')} · {o.branch_id==='zakia'?'KYO Zákia':'KYO Milenio'}</small></div><h3>Pedido #{String(o.order_number).padStart(4,'0')}</h3><p>{o.order_items?.map(i=>`${i.quantity}× ${i.product_name}`).join(' · ')}</p>{active&&<div className="client-progress"><div className={['preparing','ready','on_the_way','delivered'].includes(o.status)?'done':''}><i>1</i><span>Preparando</span></div><div className={(o.fulfillment_type==='pickup'?['ready','on_the_way','delivered']:['on_the_way','delivered']).includes(o.status)?'done':''}><i>2</i><span>{o.fulfillment_type==='pickup'?'Listo para recoger':'En camino'}</span></div><div className={o.status==='delivered'?'done':''}><i>3</i><span>Entregado</span></div></div>}<div><strong>{money(o.total)}</strong></div></article>}

function CartPage({cart,update,total,destination,selectedAddress,branch,catalog}){const nav=useNavigate();const delivery=destination.mode==='delivery';return <main><div className="simple-head"><button onClick={()=>nav(-1)}><ArrowLeft/></button><h1>Tu pedido</h1><span/></div>{cart.length===0?<EmptyState icon={<ShoppingBag/>} title="Tu carrito está vacío" text="Hay mucho KYO esperándote." button="Ver menú" onClick={()=>nav('/menu')}/>:<><section className="cart-branch"><MapPin/><div><small>{delivery?'Entregar en':'Recoger en'}</small><strong>{delivery?(selectedAddress?.label||'Dirección'):branch?.name}</strong><span>{delivery?formatAddress(selectedAddress):branch?.address}</span></div></section><section className="cart-items">{cart.map(i=><article key={i.cartLineId||i.id}><img src={i.image||i.image_url}/><div className="cart-info"><h3>{i.name}</h3>{i.selectedCustomizations?.length>0&&<div className="cart-customizations">{i.selectedCustomizations.map((c,idx)=><small key={idx}>{c.label}{c.price>0?` +${money(c.price)}`:''}</small>)}</div>}{i.itemNote&&<small className="item-note">Nota: {i.itemNote}</small>}{i.reward?<strong className="reward-free-price">GRATIS · KYO REWARDS</strong>:<strong>{money(i.price)}</strong>}</div><div className={`qty ${i.reward?'reward-qty':''}`}><button onClick={()=>update(i.cartLineId||i.id,-1)}><Trash2 size={16}/></button><b>{i.reward?'1':i.qty}</b>{!i.reward&&<button onClick={()=>update(i.cartLineId||i.id,1)}><Plus size={16}/></button>}</div></article>)}</section><section className="summary"><div><span>Subtotal</span><strong>{money(total)}</strong></div>{delivery&&<div><span>Envío</span><strong>$39</strong></div>}<div className="total"><span>Total</span><strong>{money(total+(delivery?39:0))}</strong></div></section>{total<Number(catalog?.settings?.minimum_order||200)&&<div className="minimum-order-notice cart-minimum-notice"><strong>Pedido mínimo {money(catalog?.settings?.minimum_order||200)}</strong><span>Te faltan {money(Number(catalog?.settings?.minimum_order||200)-total)} en productos.</span></div>}<div className="checkout-bar"><button disabled={total<Number(catalog?.settings?.minimum_order||200)} className="primary full" onClick={()=>nav('/checkout')}>Continuar · {money(total+(delivery?39:0))}</button></div></>}</main>}

function CheckoutPage({cart,total,auth,catalog,addressBook,destination,setDestination,selectedAddress,branch,setCart}){const nav=useNavigate();const [type,setType]=useState(destination.mode||'delivery');const [selected,setSelected]=useState(destination.addressId||'');const [pickupBranch,setPickupBranch]=useState(destination.branchId||'zakia');const [payment,setPayment]=useState('cash');const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [adding,setAdding]=useState(false);if(!auth.user)return <Navigate to="/login" replace/>;const chooseAddress=a=>{setSelected(a.id);setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id})};const finish=async()=>{setError('');if(!supabase)return setError('Supabase no está configurado.');if(!cart.length)return;const minimum=Number(catalog.settings?.minimum_order||200);if(total<minimum)return setError(`El pedido mínimo es de ${money(minimum)}. Te faltan ${money(minimum-total)} en productos.`);if(type==='delivery'&&!selected)return setError('Selecciona o agrega una dirección de entrega.');setBusy(true);const currentAddress=addressBook.addresses.find(a=>a.id===selected);const chosenBranch=type==='delivery'?currentAddress?.branch_id:pickupBranch;const items=cart.map(i=>({product_id:i.productId||i.id,quantity:i.reward?1:i.qty,reward_voucher_id:i.rewardVoucherId||null,customizations:i.selectedCustomizations||[],item_note:i.itemNote||''}));const {data,error:e1}=await supabase.rpc('create_order',{p_branch_id:chosenBranch,p_fulfillment_type:type,p_address_id:type==='delivery'?selected:null,p_delivery_notes:notes,p_payment_method:payment,p_items:items});setBusy(false);if(e1){setError(e1.message);return}const order=Array.isArray(data)?data[0]:data;setDestination(type==='delivery'?{mode:'delivery',addressId:selected,branchId:chosenBranch}:{mode:'pickup',addressId:null,branchId:pickupBranch});setCart([]);nav('/success',{state:{orderNumber:order?.order_number,fulfillmentType:type}})};return <main className="checkout-page"><div className="simple-head"><button onClick={()=>nav(-1)}><ArrowLeft/></button><h1>Finalizar pedido</h1><span/></div><section className="checkout-section"><h2>¿Cómo quieres tu pedido?</h2><div className="type-toggle"><button onClick={()=>setType('delivery')} className={type==='delivery'?'active':''}><Bike/><span><strong>Delivery</strong><small>Entrega a tu dirección</small></span></button><button onClick={()=>setType('pickup')} className={type==='pickup'?'active':''}><Store/><span><strong>Recoger</strong><small>20–30 min</small></span></button></div></section>{type==='delivery'?<section className="checkout-section"><div className="checkout-title-row"><h2>Dirección de entrega</h2><button className="text-btn" onClick={()=>setAdding(true)}><Plus size={16}/> Agregar</button></div>{addressBook.addresses.map(a=><button className={`address-option ${selected===a.id?'active':''}`} onClick={()=>chooseAddress(a)} key={a.id}><MapPin/><span><strong>{a.label} · {a.branch_id==='zakia'?'Zákia':'Milenio'}</strong><small>{formatAddress(a)}</small>{a.notes&&<em>{a.notes}</em>}</span>{selected===a.id&&<Check/>}</button>)}{addressBook.addresses.length===0&&<button className="save-login" onClick={()=>setAdding(true)}>+ Agregar dirección aquí</button>}</section>:<section className="checkout-section"><h2>¿En qué sucursal recoges?</h2>{catalog.branches.map(b=><button className={`address-option ${pickupBranch===b.id?'active':''}`} onClick={()=>setPickupBranch(b.id)} key={b.id}><Store/><span><strong>{b.name}</strong><small>{b.address}</small></span>{pickupBranch===b.id&&<Check/>}</button>)}</section>}<section className="checkout-section"><h2>Método de pago</h2><button className={`pay-option ${payment==='card'?'active':''}`} onClick={()=>setPayment('card')}><CreditCard/><span><strong>Tarjeta</strong><small>Integración de pasarela pendiente</small></span>{payment==='card'&&<Check/>}</button><button className={`pay-option ${payment==='cash'?'active':''}`} onClick={()=>setPayment('cash')}><Banknote/><span><strong>Efectivo</strong><small>Paga al recibir tu pedido</small></span>{payment==='cash'&&<Check/>}</button><label className="admin-field"><span>Notas del pedido</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sin cebolla, agregar soya..."/></label></section>{total<Number(catalog.settings?.minimum_order||200)&&<div className="minimum-order-notice"><strong>Pedido mínimo {money(catalog.settings?.minimum_order||200)}</strong><span>Agrega {money(Number(catalog.settings?.minimum_order||200)-total)} más en productos para continuar.</span></div>}{error&&<div className="form-message checkout-message">{error}</div>}<section className="summary checkout-summary"><div><span>Productos ({cart.reduce((a,i)=>a+i.qty,0)})</span><strong>{money(total)}</strong></div>{type==='delivery'&&<div><span>Envío</span><strong>$39</strong></div>}<div className="total"><span>Total</span><strong>{money(total+(type==='delivery'?39:0))}</strong></div></section><div className="checkout-bar"><button disabled={busy||total<Number(catalog.settings?.minimum_order||200)} className="primary full" onClick={finish}>{busy?'Enviando pedido...':`Confirmar pedido · ${money(total+(type==='delivery'?39:0))}`}</button></div>{adding&&<AddressModal auth={auth} branches={catalog.branches} onClose={()=>setAdding(false)} onSaved={async a=>{await addressBook.refresh();chooseAddress(a);setAdding(false)}}/>}</main>}

function SuccessPage(){
  const nav=useNavigate()
  const loc=useLocation()
  const orderNumber=loc.state?.orderNumber?String(loc.state.orderNumber).padStart(4,'0'):null
  const pickup=loc.state?.fulfillmentType==='pickup'
  return <main className="success success-v2">
    <div className="success-glow success-glow-one"></div>
    <div className="success-glow success-glow-two"></div>
    <section className="success-card">
      <div className="success-badge"><Check/></div>
      <span className="success-kicker">PEDIDO CONFIRMADO</span>
      <h1>¡Ya lo estamos preparando!</h1>
      <p className="success-lead">{pickup?'Cocina ya recibió tu pedido. Te avisaremos cuando esté listo para que pases por él.':'Gracias por pedir directo con KYO. Cocina ya recibió tu orden y empezó a trabajar en ella.'}</p>
      {orderNumber&&<div className="success-order-number"><small>NÚMERO DE PEDIDO</small><strong>#{orderNumber}</strong></div>}
      <div className="success-status-card">
        <div className="success-status-head"><span className="success-live-dot"></span><div><small>ESTADO ACTUAL</small><strong>Preparando</strong></div></div>
        <div className="success-track">
          <div className="success-track-step active"><span><Check size={15}/></span><div><strong>Preparando</strong><small>Cocina tiene tu pedido</small></div></div>
          <div className="success-track-line"></div>
          <div className="success-track-step"><span>2</span><div><strong>{pickup?'Listo para recoger':'En camino'}</strong><small>{pickup?'Te avisaremos cuando esté listo':'Te avisaremos cuando salga'}</small></div></div>
          <div className="success-track-line"></div>
          <div className="success-track-step"><span>3</span><div><strong>Entregado</strong><small>¡A disfrutar KYO!</small></div></div>
        </div>
      </div>
      <div className="success-note"><Clock3/><span><strong>Todo listo.</strong><small>{pickup?'Espera a que tu pedido cambie a “Listo para recoger”.':'No necesitas hacer nada más por ahora.'}</small></span></div>
      <button className="success-home-btn" onClick={()=>nav('/')}>Volver a inicio <ChevronRight size={19}/></button>
      <p className="success-orders-hint">En <button onClick={()=>nav('/orders')}>Pedidos</button> puedes rastrear tu pedido.</p>
    </section>
  </main>
}
function EmptyState({icon,title,text,button,onClick}){return <section className="empty"><span>{icon}</span><h2>{title}</h2><p>{text}</p><button className="primary dark-btn" onClick={onClick}>{button}</button></section>}
export default App
