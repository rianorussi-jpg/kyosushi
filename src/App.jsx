import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Home, Gift, ShoppingBag, User, Search, MapPin, ChevronRight, Flame, Plus, Minus,
  ArrowLeft, CreditCard, Banknote, Store, Bike, Check, LogOut, Settings,
  Trash2, Navigation, ChevronDown, Sparkles, RefreshCw, X, MapPinned, Pencil
} from 'lucide-react'
import { fallbackCategories, fallbackProducts, branches as fallbackBranches } from './data'
import { supabase, supabaseConfigured } from './supabase'
import { AdminGate, AdminPanel } from './pages/AdminPanel.jsx'
import { KitchenGate, KitchenMode } from './pages/KitchenMode.jsx'

const money = n => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
const clientStatus = status => status === 'delivered' ? 'Entregado' : status === 'on_the_way' ? 'En camino' : status === 'cancelled' ? 'Cancelado' : 'Preparando'
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
  const [branches,setBranches]=useState(fallbackBranches)
  const [loading,setLoading]=useState(supabaseConfigured)
  const refresh=async()=>{
    if(!supabase){setLoading(false);return}
    setLoading(true)
    const [{data:p,error:pe},{data:c},{data:b}]=await Promise.all([
      supabase.from('products').select('*, categories(name,slug), product_customizations(sort_order, customization_templates(id,name,input_type,required,min_select,max_select,options))').order('sort_order'),
      supabase.from('categories').select('*').eq('active',true).order('sort_order'),
      supabase.from('branches').select('*').eq('active',true)
    ])
    if(!pe && p?.length) setProducts(p.map(x=>({...x,price:Number(x.price),category:x.categories?.name||'Otros',desc:x.description,image:x.image_url||'/assets/kyo-logo.jpg',customizations:(x.product_customizations||[]).sort((a,b)=>a.sort_order-b.sort_order).map(pc=>pc.customization_templates).filter(Boolean)})))
    if(c?.length) setCategories(c.map(x=>x.name))
    if(b?.length) setBranches(b.map(x=>({id:x.id,name:x.name,short:x.short_name,address:x.address,phone:x.phone,eta:x.eta})))
    setLoading(false)
  }
  useEffect(()=>{refresh()},[])
  return {products,categories,branches,loading,refresh,setProducts}
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
  const update=(id,delta)=>setCart(prev=>prev.map(i=>(i.cartLineId||i.id)===id?{...i,qty:i.qty+delta}:i).filter(i=>i.qty>0))
  const panelHost=typeof window!=='undefined'&&window.location.hostname.startsWith('panel.')
  if(panelHost&&window.location.pathname==='/') return <Navigate to="/panel" replace/>

  const shared={auth,catalog,addressBook,destination,setDestination,selectedAddress,branch}
  return <div className="app-shell">
    <Routes>
      <Route path="/" element={<HomePage {...shared} add={add} cartCount={cartCount}/>}/>
      <Route path="/menu" element={<MenuPage {...shared} add={add} cartCount={cartCount} cartTotal={cartTotal}/>}/>
      <Route path="/rewards" element={<RewardsPage auth={auth} catalog={catalog} setCart={setCart}/>}/>
      <Route path="/orders" element={<OrdersPage auth={auth}/>}/>
      <Route path="/profile" element={<ProfilePage auth={auth} addressBook={addressBook} catalog={catalog}/>}/>
      <Route path="/login" element={<LoginPage auth={auth}/>}/>
      <Route path="/cart" element={<CartPage cart={cart} update={update} total={cartTotal} destination={destination} selectedAddress={selectedAddress} branch={branch}/>}/>
      <Route path="/checkout" element={<CheckoutPage cart={cart} total={cartTotal} setCart={setCart} {...shared}/>}/>
      <Route path="/success" element={<SuccessPage/>}/>
      <Route path="/panel" element={<AdminGate auth={auth}><AdminPanel auth={auth} catalog={catalog}/></AdminGate>}/>
      <Route path="/modococina" element={<KitchenGate auth={auth}><KitchenMode auth={auth}/></KitchenGate>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
    {configuring&&<ProductCustomizeModal product={configuring} onClose={()=>setConfiguring(null)} onAdd={addConfigured}/>}
    <BottomNav cartCount={cartCount}/>
  </div>
}

function Brand(){return <div className="brand"><span className="brand-mark">KYO</span><span className="brand-sub">JAPANESE SOUL FOOD</span></div>}

function formatAddress(a){
  if(!a)return ''
  return `${a.street || a.address_line || ''}${a.exterior_number?` #${a.exterior_number}`:''}${a.interior_number?` Int. ${a.interior_number}`:''}${a.neighborhood?`, ${a.neighborhood}`:''}${a.postal_code?`, CP ${a.postal_code}`:''}`
}

function Header({auth,catalog,addressBook,destination,setDestination,selectedAddress,plain=false}){
  const [open,setOpen]=useState(false); const [adding,setAdding]=useState(false); const [editingAddress,setEditingAddress]=useState(null); const nav=useNavigate()
  const chooseAddress=a=>{setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id});setOpen(false)}
  const choosePickup=id=>{setDestination({mode:'pickup',addressId:null,branchId:id});setOpen(false)}
  const label=destination?.mode==='delivery'&&selectedAddress ? (selectedAddress.label||'Entrega') : `Recoger en ${catalog?.branches?.find(b=>b.id===destination?.branchId)?.short||'sucursal'}`
  const detail=destination?.mode==='delivery'&&selectedAddress ? formatAddress(selectedAddress) : 'Pickup en sucursal'
  return <>
    <header className={`topbar ${plain?'plain':''}`}><Brand/>{!plain&&<div className="branch-wrap"><button className="branch-btn destination-btn" onClick={()=>setOpen(v=>!v)}><MapPin size={16}/><span><small>Entregar en</small><strong>{label}</strong><em>{detail}</em></span><ChevronDown size={16}/></button>{open&&<div className="branch-menu destination-menu"><div className="destination-title">¿Dónde quieres recibir tu KYO?</div>{auth?.user&&addressBook?.addresses?.map(a=><div className={`destination-address-row ${destination?.addressId===a.id?'active':''}`} key={a.id}><button className="destination-address-main" onClick={()=>chooseAddress(a)}><span><strong>{a.label||'Dirección'} · {a.branch_id==='zakia'?'Zákia':'Milenio'}</strong><small>{formatAddress(a)}</small></span></button><button className="destination-edit" onClick={()=>setEditingAddress(a)} aria-label="Editar dirección"><Pencil size={15}/></button></div>)}<button className="add-location" onClick={()=>auth?.user?setAdding(true):nav('/login')}><Plus size={16}/><span><strong>Agregar otra dirección</strong><small>Guárdala para futuros pedidos</small></span></button><div className="pickup-title">O recoger en sucursal</div>{catalog?.branches?.map(b=><button key={b.id} onClick={()=>choosePickup(b.id)} className={`pickup-option ${destination?.mode==='pickup'&&destination?.branchId===b.id?'active':''}`}><Store size={16}/><span><strong>{b.name}</strong><small>{b.address}</small></span></button>)}</div>}</div>}</header>
    {adding&&<AddressModal auth={auth} branches={catalog.branches} onClose={()=>setAdding(false)} onSaved={async a=>{await addressBook.refresh();setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id});setAdding(false);setOpen(false)}}/>}
    {editingAddress&&<AddressModal auth={auth} branches={catalog.branches} initial={editingAddress} onClose={()=>setEditingAddress(null)} onSaved={async a=>{await addressBook.refresh();if(destination?.addressId===a.id)setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id});setEditingAddress(null)}}/>}
  </>
}

function BottomNav({cartCount}){const loc=useLocation();if(['/login','/checkout','/success','/panel','/modococina'].some(p=>loc.pathname.startsWith(p)))return null;return <nav className="bottom-nav">{[['/',Home,'Inicio'],['/menu',Search,'Menú'],['/rewards',Gift,'Rewards'],['/orders',ShoppingBag,'Pedidos'],['/profile',User,'Perfil']].map(([to,Icon,label])=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>isActive?'active':''}><Icon size={21}/><span>{label}</span>{to==='/orders'&&cartCount>0?<b className="mini-badge">{cartCount}</b>:null}</NavLink>)}</nav>}

function HomePage({auth,catalog,addressBook,destination,setDestination,selectedAddress,add,cartCount}){const nav=useNavigate();const featured=catalog.products.filter(p=>p.featured&&p.available!==false).slice(0,6);const branch=catalog.branches.find(b=>b.id===(selectedAddress?.branch_id||destination.branchId))||catalog.branches[0];return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="hero"><div className="hero-copy"><span className="eyebrow">KYO A TU MANERA</span><h1>Tu sushi favorito,<br/><em>más cerca de ti.</em></h1><p>Pide directo, acumula KYO Points y recibe beneficios exclusivos.</p><button className="primary" onClick={()=>nav('/menu')}>Ordenar ahora <ChevronRight size={18}/></button></div><div className="hero-art"><div className="red-orb"></div><img src="/assets/menu/ebi-crispy-ramen.jpg" alt="Ramen KYO"/></div></section><section className="quick-row"><div><Bike/><span><strong>Delivery</strong><small>{branch?.eta||'35–50 min'}</small></span></div><div><Store/><span><strong>Pickup</strong><small>Listo en 20–30 min</small></span></div><div><Gift/><span><strong>Rewards</strong><small>1 punto por $1</small></span></div></section><section className="section"><div className="section-head"><div><span className="eyebrow dark">LOS MÁS PEDIDOS</span><h2>Favoritos de KYO</h2></div><button className="text-btn" onClick={()=>nav('/menu')}>Ver todo <ChevronRight size={17}/></button></div><div className="product-scroller">{featured.map(p=><ProductCard key={p.id} p={p} add={add}/>)}</div></section><section className="reward-banner"><div><span className="reward-icon"><Sparkles/></span><span><small>KYO REWARDS</small><strong>Come rico. Gana puntos.<br/>Recibe más KYO.</strong></span></div><button onClick={()=>nav('/rewards')}>Ver mis beneficios</button></section>{cartCount>0&&<button className="floating-cart" onClick={()=>nav('/cart')}><ShoppingBag size={20}/><span>Ver carrito</span><b>{cartCount}</b></button>}</main>}

function ProductCard({p,add}){return <article className="product-card"><div className="product-img"><img src={p.image||p.image_url} alt={p.name}/>{p.spicy&&<span className="spicy"><Flame size={13}/> Spicy</span>}</div><div className="product-body"><small>{p.category}</small><h3>{p.name}</h3><p>{p.desc||p.description}</p><div><strong>{money(p.price)}</strong><button className="add-btn" onClick={()=>add(p)} aria-label={`Agregar ${p.name}`}><Plus/></button></div></div></article>}

function MenuPage(props){const {auth,catalog,addressBook,destination,setDestination,selectedAddress,add,cartCount,cartTotal}=props;const nav=useNavigate();const [params]=useSearchParams();const [cat,setCat]=useState(params.get('category')||'Favoritos');const [q,setQ]=useState('');const categoryList=['Favoritos',...catalog.categories];const shown=useMemo(()=>catalog.products.filter(p=>p.available!==false).filter(p=>cat==='Favoritos'?p.featured:p.category===cat).filter(p=>(p.name+' '+(p.desc||'')).toLowerCase().includes(q.toLowerCase())),[catalog.products,cat,q]);return <main><Header auth={auth} catalog={catalog} addressBook={addressBook} destination={destination} setDestination={setDestination} selectedAddress={selectedAddress}/><section className="menu-head"><span className="eyebrow dark">MENÚ KYO</span><h1>¿Qué se te antoja?</h1><div className="search-box"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar ramen, rollos, entradas..."/></div></section><div className="cat-tabs">{categoryList.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>{catalog.loading?<div className="loading-state"><RefreshCw className="spin"/> Cargando menú...</div>:<section className="menu-grid">{shown.map(p=><ProductCard key={p.id} p={p} add={add}/>)}</section>}{shown.length===0&&!catalog.loading&&<EmptyState icon={<Search/>} title="No encontramos productos" text="Prueba otra categoría o búsqueda." button="Ver favoritos" onClick={()=>setCat('Favoritos')}/>} {cartCount>0&&<button className="floating-cart" onClick={()=>nav('/cart')}><ShoppingBag size={20}/><span>Ver carrito</span><b>{cartCount}</b></button>}</main>}

function ProductCustomizeModal({product,onClose,onAdd}){
  const templates=product.customizations||[]
  const [selected,setSelected]=useState({})
  const [note,setNote]=useState('')
  const [error,setError]=useState('')
  const choose=(t,opt)=>setSelected(prev=>{
    const current=prev[t.id]||{}
    if(t.input_type==='single') return {...prev,[t.id]:{[opt.id]:1}}
    if(t.input_type==='multiple') return {...prev,[t.id]:{...current,[opt.id]:current[opt.id]?0:1}}
    return prev
  })
  const qty=(t,opt,delta)=>setSelected(prev=>{const current=prev[t.id]||{};return {...prev,[t.id]:{...current,[opt.id]:Math.max(0,Math.min(20,(current[opt.id]||0)+delta))}}})
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
        rows.push({template_id:t.id,option_id:opt.id,label:t.input_type==='quantity'?`${q}× ${opt.name}`:opt.name,quantity:q,price:Number(opt.price||0)*q})
      }
    }
    const extras=rows.reduce((a,r)=>a+r.price,0)
    onAdd({...product,basePrice:Number(product.price),price:Number(product.price)+extras,selectedCustomizations:rows,itemNote:note.trim()})
  }
  return <div className="modal-backdrop product-config-backdrop"><div className="product-config-modal"><div className="modal-head"><div><small>PERSONALIZA TU PEDIDO</small><h2>{product.name}</h2></div><button onClick={onClose}><X/></button></div><div className="config-product-head"><img src={product.image||product.image_url}/><div><p>{product.desc||product.description}</p><strong>{money(product.price)}</strong></div></div>{templates.map(t=><section className="config-group" key={t.id}><div className="config-group-title"><div><h3>{t.name}</h3><small>{t.required?'Obligatorio':'Opcional'} · {t.input_type==='single'?'Elige una':t.input_type==='multiple'?`Marca hasta ${t.max_select||'varias'}`:'Elige cantidades'}</small></div>{t.required&&<b>REQUERIDO</b>}</div><div className="config-options">{(t.options||[]).map(opt=>{const n=selected[t.id]?.[opt.id]||0;return <div className={`config-option ${n?'selected':''}`} key={opt.id}><span><strong>{opt.name}</strong><small>{Number(opt.price)>0?`+ ${money(opt.price)}`:'Sin costo'}</small></span>{t.input_type==='quantity'?<div className="config-qty"><button onClick={()=>qty(t,opt,-1)}><Minus size={15}/></button><b>{n}</b><button onClick={()=>qty(t,opt,1)}><Plus size={15}/></button></div>:<button className="config-check" onClick={()=>choose(t,opt)}>{n?<Check size={16}/>:null}</button>}</div>})}</div></section>)}<label className="product-note"><span>Nota para este producto <small>(opcional)</small></span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej. Sin cebollín, salsa aparte..." maxLength={250}/></label>{error&&<div className="form-message">{error}</div>}<div className="product-config-footer"><button className="primary full" onClick={finish}>Agregar al carrito</button></div></div></div>
}

function LoginPage({auth}){const nav=useNavigate();const [mode,setMode]=useState('login');const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);useEffect(()=>{if(auth.user)nav('/',{replace:true})},[auth.user]);const submit=async e=>{e.preventDefault();setError('');if(!supabase){setError('Falta configurar Supabase.');return}setBusy(true);const result=mode==='register'?await supabase.auth.signUp({email,password,options:{data:{full_name:name}}}):await supabase.auth.signInWithPassword({email,password});setBusy(false);if(result.error){setError(result.error.message);return}if(mode==='register'&&!result.data.session){setError('Cuenta creada. Revisa tu correo para confirmar el acceso.');return}nav('/')};return <main className="auth-page"><button className="back" onClick={()=>nav(-1)}><ArrowLeft/></button><div className="auth-brand"><Brand/><p>Tu KYO. Tus rewards. Tu pedido.</p></div><form className="auth-card" onSubmit={submit}><div className="auth-tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Iniciar sesión</button><button type="button" className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Crear cuenta</button></div>{mode==='register'&&<label>Nombre<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label>}<label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label><label>Contraseña<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>{error&&<div className="form-message">{error}</div>}<button disabled={busy} className="primary full">{busy?'Procesando...':mode==='login'?'Entrar a mi cuenta':'Crear mi cuenta'}</button></form></main>}

function AddressModal({auth,branches,onClose,onSaved,initial=null}){const [form,setForm]=useState(initial?{...emptyAddress,...initial}:{...emptyAddress});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const save=async e=>{e.preventDefault();if(!supabase||!auth.user)return;setBusy(true);setError('');const payload={user_id:auth.user.id,label:form.label||'Casa',street:form.street,exterior_number:form.exterior_number,interior_number:form.interior_number||null,neighborhood:form.neighborhood,postal_code:form.postal_code,branch_id:form.branch_id,notes:form.notes||null,address_line:formatAddress(form)};const result=initial?.id?await supabase.from('addresses').update(payload).eq('id',initial.id).select().single():await supabase.from('addresses').insert(payload).select().single();setBusy(false);if(result.error){setError(result.error.message);return}onSaved(result.data)};return <div className="modal-backdrop"><form className="address-editor" onSubmit={save}><div className="modal-head"><div><small>{initial?'EDITAR DIRECCIÓN':'NUEVA DIRECCIÓN'}</small><h2>{initial?'Edita tu dirección':'¿Dónde entregamos?'}</h2></div><button type="button" onClick={onClose}><X/></button></div><div className="address-form-grid"><label className="admin-field full-span"><span>Nombre de la dirección</span><input value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="Casa, Oficina..."/></label><label className="admin-field full-span"><span>Dirección / calle</span><input required value={form.street} onChange={e=>setForm({...form,street:e.target.value})} placeholder="Av. Paseo de..."/></label><label className="admin-field"><span>Número exterior</span><input required value={form.exterior_number} onChange={e=>setForm({...form,exterior_number:e.target.value})}/></label><label className="admin-field"><span>Número interior</span><input value={form.interior_number||''} onChange={e=>setForm({...form,interior_number:e.target.value})} placeholder="Opcional"/></label><label className="admin-field"><span>Colonia</span><input required value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})}/></label><label className="admin-field"><span>Código postal</span><input required inputMode="numeric" value={form.postal_code} onChange={e=>setForm({...form,postal_code:e.target.value})}/></label><label className="admin-field full-span"><span>Sucursal que atenderá esta dirección</span><select value={form.branch_id} onChange={e=>setForm({...form,branch_id:e.target.value})}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="admin-field full-span"><span>Detalles o referencias</span><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Portón negro, frente al parque, tocar timbre..."/></label></div>{error&&<div className="form-message">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Guardando...':'Guardar dirección'}</button></div></form></div>}

function ProfilePage({auth,addressBook,catalog}){
  const nav=useNavigate(); const [showAddresses,setShowAddresses]=useState(false); const [adding,setAdding]=useState(false); const [editing,setEditing]=useState(null)
  if(!auth.user)return <main><Header plain/><section className="page-intro"><span className="eyebrow dark">MI KYO</span><h1>Tu cuenta KYO</h1><p>Inicia sesión para guardar direcciones, ver pedidos y acumular rewards.</p><button className="primary dark-btn" onClick={()=>nav('/login')}>Iniciar sesión</button></section><GuestBenefits/></main>
  return <main><Header plain/><section className="profile-hero"><div className="avatar">{(auth.profile?.full_name||auth.user.email||'K')[0].toUpperCase()}</div><div><small>HOLA,</small><h1>{auth.profile?.full_name||'Cliente KYO'}</h1><p>{auth.user.email}</p></div></section><section className="profile-stats"><div><strong>{auth.profile?.reward_points||0}</strong><small>KYO Points</small></div><div><strong>{addressBook.addresses.length}</strong><small>Direcciones</small></div></section><section className="profile-menu"><button onClick={()=>setShowAddresses(v=>!v)}><span><MapPin/> Mis direcciones <small className="profile-count">{addressBook.addresses.length}</small></span><ChevronRight className={showAddresses?'rotate':''}/></button>{showAddresses&&<div className="profile-address-panel"><div className="profile-address-head"><div><small>DIRECCIONES GUARDADAS</small><strong>Elige, edita o agrega una dirección</strong></div><button className="text-btn" onClick={()=>setAdding(true)}><Plus size={16}/> Agregar</button></div><div className="address-list">{addressBook.addresses.map(a=><div className="address-option" key={a.id}><MapPin/><span><strong>{a.label} · {a.branch_id==='zakia'?'Zákia':'Milenio'}</strong><small>{formatAddress(a)}</small>{a.notes&&<em>{a.notes}</em>}</span><div className="address-actions"><button onClick={()=>setEditing(a)} title="Editar"><Pencil size={16}/></button><button onClick={async()=>{await supabase.from('addresses').delete().eq('id',a.id);addressBook.refresh()}} title="Eliminar"><Trash2 size={16}/></button></div></div>)}{!addressBook.addresses.length&&<button className="save-login" onClick={()=>setAdding(true)}>+ Agregar mi primera dirección</button>}</div></div>}<button><span><Settings/> Preferencias</span><ChevronRight/></button><button className="logout" onClick={()=>supabase.auth.signOut()}><span><LogOut/> Cerrar sesión</span></button></section>{adding&&<AddressModal auth={auth} branches={catalog.branches} onClose={()=>setAdding(false)} onSaved={async()=>{await addressBook.refresh();setAdding(false)}}/>}{editing&&<AddressModal auth={auth} branches={catalog.branches} initial={editing} onClose={()=>setEditing(null)} onSaved={async()=>{await addressBook.refresh();setEditing(null)}}/>}</main>
}

function GuestBenefits(){return <section className="section"><div className="benefit-boxes"><div><Gift/><strong>Rewards exclusivos</strong><p>Acumula puntos en pedidos entregados.</p></div><div><MapPin/><strong>Direcciones guardadas</strong><p>Pide en menos pasos la próxima vez.</p></div><div><ShoppingBag/><strong>Historial completo</strong><p>Consulta todos tus pedidos.</p></div></div></section>}

function RewardsPage({auth,catalog,setCart}){
  const nav=useNavigate(); const [vouchers,setVouchers]=useState([]); const [busy,setBusy]=useState(''); const [msg,setMsg]=useState('')
  const load=async()=>{if(!supabase||!auth.user)return;const {data}=await supabase.from('reward_vouchers').select('*').eq('user_id',auth.user.id).eq('status','available').order('created_at',{ascending:false});setVouchers(data||[])}
  useEffect(()=>{load()},[auth.user?.id])
  if(!auth.user)return <main><Header plain/><EmptyState icon={<Gift/>} title="Tus rewards viven aquí" text="Inicia sesión para acumular KYO Points." button="Iniciar sesión" onClick={()=>nav('/login')}/></main>
  const points=auth.profile?.reward_points||0; const stamps=Math.min(6,auth.profile?.reward_order_stamps||0)
  const springProduct=catalog.products.find(p=>p.slug==='spring-rolls'||p.name?.toLowerCase()==='4 spring rolls')
  const addVoucherToCart=(voucher,product=springProduct)=>{
    if(!product){setMsg('No encontramos 4 Spring Rolls en el menú. Revisa que el producto esté disponible.');return false}
    setCart(prev=>{
      if(prev.some(i=>i.rewardVoucherId===voucher.id))return prev
      return [...prev,{...product,id:`reward-${voucher.id}`,productId:product.id,price:0,qty:1,reward:true,rewardType:voucher.reward_type,rewardVoucherId:voucher.id,name:'4 Spring Rolls',desc:'Beneficio KYO Rewards · 250 puntos'}]
    })
    setMsg('¡Listo! Agregamos 4 Spring Rolls GRATIS a tu carrito.')
    return true
  }
  const redeem=async(type)=>{
    setBusy(type);setMsg('');const fn=type==='spring_rolls'?'redeem_spring_rolls_reward':'redeem_six_orders_reward';const {data,error}=await supabase.rpc(fn);setBusy('');if(error){setMsg(error.message);return}
    await auth.refreshProfile();await load()
    if(type==='spring_rolls'){
      const voucher={id:Array.isArray(data)?data[0]:data,reward_type:'spring_rolls'}
      if(addVoucherToCart(voucher)) setTimeout(()=>nav('/cart'),450)
    }else setMsg('¡Completaste tu tarjeta! Tu beneficio de rollo gratis quedó disponible.')
  }
  return <main><Header plain/><section className="page-intro rewards-intro"><span className="eyebrow dark">KYO REWARDS</span><h1>{points} puntos</h1><p>Ganas 1 punto por cada $1 de subtotal cuando tu pedido se marca como entregado.</p></section><section className="reward-banner rewards-balance"><div><span className="reward-icon"><Gift/></span><span><small>TU SALDO</small><strong>{points} KYO Points</strong></span></div></section><section className="section reward-benefits"><div className="section-head"><div><span className="eyebrow dark">TUS BENEFICIOS</span><h2>Canjea y disfruta</h2></div></div><div className="reward-grid"><article className="reward-card points-reward-card"><div className="reward-card-icon"><Gift/></div><div className="reward-card-copy"><small>BENEFICIO POR PUNTOS</small><h3>4 Spring Rolls gratis</h3><p>Canjéalos por <strong>250 puntos</strong>. Al canjearlos se agregan directamente a tu carrito en $0.</p></div><button className="primary" disabled={points<250||busy==='spring_rolls'||!springProduct} onClick={()=>redeem('spring_rolls')}>{busy==='spring_rolls'?'Canjeando...':!springProduct?'Producto no disponible':points>=250?'Canjear y agregar al carrito':`Te faltan ${250-points} puntos`}</button></article><article className="reward-card stamp-card"><div><small>RETO KYO</small><h3>Tu 6.º pedido invita el rollo</h3><p>Completa 6 pedidos entregados y canjea un rollo gratis.</p></div><div className="stamp-row">{Array.from({length:6},(_,i)=><span key={i} className={i<stamps?'done':''}>{i<stamps?<Check size={16}/>:i+1}</span>)}</div><div className="stamp-progress"><strong>{stamps}/6 pedidos</strong><small>{stamps>=6?'¡Beneficio listo para canjear!':`Te faltan ${6-stamps} pedidos`}</small></div><button className="primary dark-btn" disabled={stamps<6||busy==='six_orders'} onClick={()=>redeem('six_orders')}>{busy==='six_orders'?'Canjeando...':stamps>=6?'Canjear rollo gratis':'Sigue acumulando'}</button></article></div>{msg&&<div className="reward-message">{msg}</div>}{vouchers.length>0&&<div className="available-rewards"><span className="eyebrow dark">BENEFICIOS GUARDADOS</span><h3>Rewards que todavía no has usado</h3>{vouchers.map(v=><div key={v.id}><Gift size={17}/><span><strong>{v.reward_type==='spring_rolls'?'4 Spring Rolls gratis':'Rollo gratis'}</strong><small>{v.reward_type==='spring_rolls'?'Puedes agregarlos a tu carrito ahora.':'Disponible para una próxima compra.'}</small></span>{v.reward_type==='spring_rolls'&&<button className="reward-cart-btn" onClick={()=>addVoucherToCart(v)}>Agregar gratis</button>}</div>)}</div>}</section></main>
}
function OrdersPage({auth}){const nav=useNavigate();const [orders,setOrders]=useState([]);const [loading,setLoading]=useState(true);const load=async()=>{if(!supabase||!auth.user){setLoading(false);return}const {data}=await supabase.from('orders').select('*, order_items(*)').eq('user_id',auth.user.id).order('created_at',{ascending:false});setOrders(data||[]);setLoading(false)};useEffect(()=>{load();if(!supabase||!auth.user)return;const ch=supabase.channel(`client-orders-${auth.user.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:`user_id=eq.${auth.user.id}`},load).subscribe();return()=>supabase.removeChannel(ch)},[auth.user?.id]);if(!auth.user)return <main><Header plain/><EmptyState icon={<ShoppingBag/>} title="Tus pedidos en un solo lugar" text="Inicia sesión para ver tu historial y seguimiento." button="Iniciar sesión" onClick={()=>nav('/login')}/></main>;const active=orders.filter(o=>!['delivered','cancelled'].includes(o.status));const history=orders.filter(o=>['delivered','cancelled'].includes(o.status));return <main><Header plain/><section className="page-intro compact"><span className="eyebrow dark">MIS PEDIDOS</span><h1>Tu pedido</h1></section>{loading?<div className="loading-state"><RefreshCw className="spin"/> Cargando...</div>:<section className="orders"><div className="orders-group-title">PEDIDO ACTUAL</div>{active.map(o=><OrderCard key={o.id} o={o} active/>)}{active.length===0&&<div className="no-active-order"><ShoppingBag/><div><strong>No tienes un pedido en curso</strong><small>Cuando hagas uno, podrás seguirlo aquí.</small></div><button className="primary" onClick={()=>nav('/menu')}>Hacer pedido</button></div>}{history.length>0&&<><div className="orders-group-title history-title">ANTERIORES</div>{history.map(o=><OrderCard key={o.id} o={o}/>)}</>}</section>}</main>}
function OrderCard({o,active}){const state=clientStatus(o.status);return <article className={active?'active-order-card':''}><div><span className={`status ${o.status==='delivered'?'completed':''}`}><Check size={15}/> {state}</span><small>{new Date(o.created_at).toLocaleString('es-MX')} · {o.branch_id==='zakia'?'KYO Zákia':'KYO Milenio'}</small></div><h3>Pedido #{String(o.order_number).padStart(4,'0')}</h3><p>{o.order_items?.map(i=>`${i.quantity}× ${i.product_name}`).join(' · ')}</p>{active&&<div className="client-progress"><div className={['preparing','ready','on_the_way','delivered'].includes(o.status)?'done':''}><i>1</i><span>Preparando</span></div><div className={['on_the_way','delivered'].includes(o.status)?'done':''}><i>2</i><span>En camino</span></div><div className={o.status==='delivered'?'done':''}><i>3</i><span>Entregado</span></div></div>}<div><strong>{money(o.total)}</strong></div></article>}

function CartPage({cart,update,total,destination,selectedAddress,branch}){const nav=useNavigate();const delivery=destination.mode==='delivery';return <main><div className="simple-head"><button onClick={()=>nav(-1)}><ArrowLeft/></button><h1>Tu pedido</h1><span/></div>{cart.length===0?<EmptyState icon={<ShoppingBag/>} title="Tu carrito está vacío" text="Hay mucho KYO esperándote." button="Ver menú" onClick={()=>nav('/menu')}/>:<><section className="cart-branch"><MapPin/><div><small>{delivery?'Entregar en':'Recoger en'}</small><strong>{delivery?(selectedAddress?.label||'Dirección'):branch?.name}</strong><span>{delivery?formatAddress(selectedAddress):branch?.address}</span></div></section><section className="cart-items">{cart.map(i=><article key={i.cartLineId||i.id}><img src={i.image||i.image_url}/><div className="cart-info"><h3>{i.name}</h3>{i.selectedCustomizations?.length>0&&<div className="cart-customizations">{i.selectedCustomizations.map((c,idx)=><small key={idx}>{c.label}{c.price>0?` +${money(c.price)}`:''}</small>)}</div>}{i.itemNote&&<small className="item-note">Nota: {i.itemNote}</small>}{i.reward?<strong className="reward-free-price">GRATIS · KYO REWARDS</strong>:<strong>{money(i.price)}</strong>}</div><div className={`qty ${i.reward?'reward-qty':''}`}><button onClick={()=>update(i.cartLineId||i.id,-1)}><Trash2 size={16}/></button><b>{i.reward?'1':i.qty}</b>{!i.reward&&<button onClick={()=>update(i.cartLineId||i.id,1)}><Plus size={16}/></button>}</div></article>)}</section><section className="summary"><div><span>Subtotal</span><strong>{money(total)}</strong></div>{delivery&&<div><span>Envío</span><strong>$39</strong></div>}<div className="total"><span>Total</span><strong>{money(total+(delivery?39:0))}</strong></div></section><div className="checkout-bar"><button className="primary full" onClick={()=>nav('/checkout')}>Continuar · {money(total+(delivery?39:0))}</button></div></>}</main>}

function CheckoutPage({cart,total,auth,catalog,addressBook,destination,setDestination,selectedAddress,branch,setCart}){const nav=useNavigate();const [type,setType]=useState(destination.mode||'delivery');const [selected,setSelected]=useState(destination.addressId||'');const [pickupBranch,setPickupBranch]=useState(destination.branchId||'zakia');const [payment,setPayment]=useState('cash');const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [adding,setAdding]=useState(false);if(!auth.user)return <Navigate to="/login" replace/>;const chooseAddress=a=>{setSelected(a.id);setDestination({mode:'delivery',addressId:a.id,branchId:a.branch_id})};const finish=async()=>{setError('');if(!supabase)return setError('Supabase no está configurado.');if(!cart.length)return;if(type==='delivery'&&!selected)return setError('Selecciona o agrega una dirección de entrega.');setBusy(true);const currentAddress=addressBook.addresses.find(a=>a.id===selected);const chosenBranch=type==='delivery'?currentAddress?.branch_id:pickupBranch;const items=cart.map(i=>({product_id:i.productId||i.id,quantity:i.reward?1:i.qty,reward_voucher_id:i.rewardVoucherId||null,customizations:i.selectedCustomizations||[],item_note:i.itemNote||''}));const {data,error:e1}=await supabase.rpc('create_order',{p_branch_id:chosenBranch,p_fulfillment_type:type,p_address_id:type==='delivery'?selected:null,p_delivery_notes:notes,p_payment_method:payment,p_items:items});setBusy(false);if(e1){setError(e1.message);return}const order=Array.isArray(data)?data[0]:data;setDestination(type==='delivery'?{mode:'delivery',addressId:selected,branchId:chosenBranch}:{mode:'pickup',addressId:null,branchId:pickupBranch});setCart([]);nav('/success',{state:{orderNumber:order?.order_number}})};return <main className="checkout-page"><div className="simple-head"><button onClick={()=>nav(-1)}><ArrowLeft/></button><h1>Finalizar pedido</h1><span/></div><section className="checkout-section"><h2>¿Cómo quieres tu pedido?</h2><div className="type-toggle"><button onClick={()=>setType('delivery')} className={type==='delivery'?'active':''}><Bike/><span><strong>Delivery</strong><small>Entrega a tu dirección</small></span></button><button onClick={()=>setType('pickup')} className={type==='pickup'?'active':''}><Store/><span><strong>Recoger</strong><small>20–30 min</small></span></button></div></section>{type==='delivery'?<section className="checkout-section"><div className="checkout-title-row"><h2>Dirección de entrega</h2><button className="text-btn" onClick={()=>setAdding(true)}><Plus size={16}/> Agregar</button></div>{addressBook.addresses.map(a=><button className={`address-option ${selected===a.id?'active':''}`} onClick={()=>chooseAddress(a)} key={a.id}><MapPin/><span><strong>{a.label} · {a.branch_id==='zakia'?'Zákia':'Milenio'}</strong><small>{formatAddress(a)}</small>{a.notes&&<em>{a.notes}</em>}</span>{selected===a.id&&<Check/>}</button>)}{addressBook.addresses.length===0&&<button className="save-login" onClick={()=>setAdding(true)}>+ Agregar dirección aquí</button>}</section>:<section className="checkout-section"><h2>¿En qué sucursal recoges?</h2>{catalog.branches.map(b=><button className={`address-option ${pickupBranch===b.id?'active':''}`} onClick={()=>setPickupBranch(b.id)} key={b.id}><Store/><span><strong>{b.name}</strong><small>{b.address}</small></span>{pickupBranch===b.id&&<Check/>}</button>)}</section>}<section className="checkout-section"><h2>Método de pago</h2><button className={`pay-option ${payment==='card'?'active':''}`} onClick={()=>setPayment('card')}><CreditCard/><span><strong>Tarjeta</strong><small>Integración de pasarela pendiente</small></span>{payment==='card'&&<Check/>}</button><button className={`pay-option ${payment==='cash'?'active':''}`} onClick={()=>setPayment('cash')}><Banknote/><span><strong>Efectivo</strong><small>Paga al recibir tu pedido</small></span>{payment==='cash'&&<Check/>}</button><label className="admin-field"><span>Notas del pedido</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sin cebolla, agregar soya..."/></label></section>{error&&<div className="form-message checkout-message">{error}</div>}<section className="summary checkout-summary"><div><span>Productos ({cart.reduce((a,i)=>a+i.qty,0)})</span><strong>{money(total)}</strong></div>{type==='delivery'&&<div><span>Envío</span><strong>$39</strong></div>}<div className="total"><span>Total</span><strong>{money(total+(type==='delivery'?39:0))}</strong></div></section><div className="checkout-bar"><button disabled={busy} className="primary full" onClick={finish}>{busy?'Enviando pedido...':`Confirmar pedido · ${money(total+(type==='delivery'?39:0))}`}</button></div>{adding&&<AddressModal auth={auth} branches={catalog.branches} onClose={()=>setAdding(false)} onSaved={async a=>{await addressBook.refresh();chooseAddress(a);setAdding(false)}}/>}</main>}

function SuccessPage(){const nav=useNavigate();const loc=useLocation();return <main className="success"><div className="success-check"><Check/></div><span className="eyebrow dark">¡PEDIDO CONFIRMADO!</span><h1>Gracias por pedir KYO.</h1><p>{loc.state?.orderNumber?`Tu pedido #${String(loc.state.orderNumber).padStart(4,'0')} ya está en preparación.`:'Tu pedido ya está en preparación.'}</p><div className="order-progress"><div className="done"><i><Check/></i><span><strong>Preparando</strong><small>Cocina ya tiene tu pedido</small></span></div><div><i>2</i><span><strong>En camino</strong><small>Te avisaremos cuando salga a ruta</small></span></div><div><i>3</i><span><strong>Entregado</strong><small>¡A disfrutar!</small></span></div></div><button className="primary dark-btn" onClick={()=>nav('/orders')}>Ver mi pedido</button></main>}
function EmptyState({icon,title,text,button,onClick}){return <section className="empty"><span>{icon}</span><h2>{title}</h2><p>{text}</p><button className="primary dark-btn" onClick={onClick}>{button}</button></section>}
export default App
