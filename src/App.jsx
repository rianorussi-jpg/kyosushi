import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Home, Gift, ShoppingBag, User, Search, MapPin, ChevronRight, Flame, Plus, Minus,
  ArrowLeft, CreditCard, Banknote, Store, Bike, Check, Clock3, LogOut, Settings, Bell,
  MapPinned, Trash2, Navigation, ChevronDown, Sparkles, Upload, Pencil, Package,
  LayoutDashboard, Utensils, RefreshCw, AlertTriangle, Save, X, ShieldCheck
} from 'lucide-react'
import { fallbackCategories, fallbackProducts, branches as fallbackBranches } from './data'
import { supabase, supabaseConfigured } from './supabase'
import { AdminGate, AdminPanel } from './pages/AdminPanel.jsx'

const money = n => `$${Number(n || 0).toLocaleString('es-MX', {maximumFractionDigits: 2})}`
const statusLabels = {
  received:'Recibido', accepted:'Aceptado', preparing:'Preparando', ready:'Listo',
  on_the_way:'En camino', delivered:'Entregado', cancelled:'Cancelado'
}

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
    supabase.auth.getSession().then(async ({data})=>{
      setSession(data.session)
      await loadProfile(data.session?.user)
      setLoading(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async (_event,next)=>{
      setSession(next)
      await loadProfile(next?.user)
      setLoading(false)
    })
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
      supabase.from('products').select('*, categories(name,slug)').order('sort_order'),
      supabase.from('categories').select('*').eq('active',true).order('sort_order'),
      supabase.from('branches').select('*').eq('active',true)
    ])
    if(!pe && p?.length) setProducts(p.map(x=>({
      ...x, price:Number(x.price), category:x.categories?.name||'Otros', desc:x.description,
      image:x.image_url || '/assets/kyo-logo.jpg'
    })))
    if(c?.length) setCategories(c.map(x=>x.name))
    if(b?.length) setBranches(b.map(x=>({id:x.id,name:x.name,short:x.short_name,address:x.address,phone:x.phone,eta:x.eta})))
    setLoading(false)
  }
  useEffect(()=>{refresh()},[])
  return {products,categories,branches,loading,refresh,setProducts}
}

function App(){
  const auth=useAuth()
  const catalog=useCatalog()
  const [cart,setCart]=usePersistedState('kyo-cart-v3',[])
  const [branch,setBranch]=usePersistedState('kyo-branch-v3',fallbackBranches[0])
  const cartCount=cart.reduce((a,i)=>a+i.qty,0)
  const cartTotal=cart.reduce((a,i)=>a+Number(i.price)*i.qty,0)

  useEffect(()=>{
    if(catalog.branches.length && !catalog.branches.find(b=>b.id===branch?.id)) setBranch(catalog.branches[0])
  },[catalog.branches])

  const add=p=>setCart(prev=>{
    const found=prev.find(i=>i.id===p.id)
    return found ? prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i) : [...prev,{...p,qty:1}]
  })
  const update=(id,delta)=>setCart(prev=>prev.map(i=>i.id===id?{...i,qty:i.qty+delta}:i).filter(i=>i.qty>0))

  const panelHost = typeof window!=='undefined' && window.location.hostname.startsWith('panel.')
  if(panelHost && window.location.pathname==='/') return <Navigate to="/panel" replace/>

  return <div className="app-shell">
    <Routes>
      <Route path="/" element={<HomePage catalog={catalog} add={add} cartCount={cartCount} branch={branch} setBranch={setBranch}/>} />
      <Route path="/menu" element={<MenuPage catalog={catalog} add={add} branch={branch} setBranch={setBranch} cartCount={cartCount} cartTotal={cartTotal}/>} />
      <Route path="/rewards" element={<RewardsPage auth={auth}/>} />
      <Route path="/orders" element={<OrdersPage auth={auth}/>} />
      <Route path="/profile" element={<ProfilePage auth={auth}/>} />
      <Route path="/login" element={<LoginPage auth={auth}/>} />
      <Route path="/cart" element={<CartPage cart={cart} update={update} total={cartTotal} branch={branch}/>} />
      <Route path="/checkout" element={<CheckoutPage cart={cart} total={cartTotal} auth={auth} branch={branch} setCart={setCart}/>} />
      <Route path="/success" element={<SuccessPage/>}/>
      <Route path="/panel" element={<AdminGate auth={auth}><AdminPanel auth={auth} catalog={catalog}/></AdminGate>} />
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
    <BottomNav cartCount={cartCount}/>
  </div>
}

function Brand(){return <div className="brand"><span className="brand-mark">KYO</span><span className="brand-sub">JAPANESE SOUL FOOD</span></div>}
function Header({branch,setBranch,branches=fallbackBranches,plain=false}){
  const [open,setOpen]=useState(false)
  return <header className={`topbar ${plain?'plain':''}`}><Brand/>{!plain&&<div className="branch-wrap"><button className="branch-btn" onClick={()=>setOpen(v=>!v)}><MapPin size={16}/><span><small>Tu sucursal</small>{branch?.short}</span><ChevronDown size={16}/></button>{open&&<div className="branch-menu">{branches.map(b=><button key={b.id} onClick={()=>{setBranch(b);setOpen(false)}} className={branch?.id===b.id?'active':''}><strong>{b.name}</strong><small>{b.address}</small></button>)}</div>}</div>}</header>
}
function BottomNav({cartCount}){
  const loc=useLocation()
  if(['/login','/checkout','/success','/panel'].some(p=>loc.pathname.startsWith(p))) return null
  return <nav className="bottom-nav">{[[ '/',Home,'Inicio'],['/menu',Search,'Menú'],['/rewards',Gift,'Rewards'],['/orders',ShoppingBag,'Pedidos'],['/profile',User,'Perfil']].map(([to,Icon,label])=><NavLink key={to} to={to} end={to==='/' } className={({isActive})=>isActive?'active':''}><Icon size={21}/><span>{label}</span>{to==='/orders'&&cartCount>0?<b className="mini-badge">{cartCount}</b>:null}</NavLink>)}</nav>
}

function HomePage({catalog,add,cartCount,branch,setBranch}){
  const nav=useNavigate(); const featured=catalog.products.filter(p=>p.featured&&p.available!==false).slice(0,6)
  return <main><Header branch={branch} setBranch={setBranch} branches={catalog.branches}/><section className="hero"><div className="hero-copy"><span className="eyebrow">KYO A TU MANERA</span><h1>Tu sushi favorito,<br/><em>más cerca de ti.</em></h1><p>Pide directo, acumula KYO Points y recibe beneficios exclusivos.</p><button className="primary" onClick={()=>nav('/menu')}>Ordenar ahora <ChevronRight size={18}/></button></div><div className="hero-art"><div className="red-orb"></div><img src="/assets/menu/ebi-crispy-ramen.jpg" alt="Ramen KYO"/></div></section>
  <section className="quick-row"><div><Bike/><span><strong>Delivery</strong><small>{branch?.eta||'35–50 min'}</small></span></div><div><Store/><span><strong>Pickup</strong><small>Listo en 20–30 min</small></span></div><div><Gift/><span><strong>Rewards</strong><small>1 punto por $1</small></span></div></section>
  <section className="section"><div className="section-head"><div><span className="eyebrow dark">LOS MÁS PEDIDOS</span><h2>Favoritos de KYO</h2></div><button className="text-btn" onClick={()=>nav('/menu')}>Ver todo <ChevronRight size={17}/></button></div><div className="product-scroller">{featured.map(p=><ProductCard key={p.id} p={p} add={add}/>)}</div></section>
  <section className="reward-banner"><div><span className="reward-icon"><Sparkles/></span><span><small>KYO REWARDS</small><strong>Come rico. Gana puntos.<br/>Recibe más KYO.</strong></span></div><button onClick={()=>nav('/rewards')}>Ver mis beneficios</button></section>
  {cartCount>0&&<button className="floating-cart" onClick={()=>nav('/cart')}><ShoppingBag size={20}/><span>Ver carrito</span><b>{cartCount}</b></button>}</main>
}

function ProductCard({p,add}){return <article className="product-card"><div className="product-img"><img src={p.image||p.image_url} alt={p.name}/>{p.spicy&&<span className="spicy"><Flame size={13}/> Spicy</span>}</div><div className="product-body"><small>{p.category}</small><h3>{p.name}</h3><p>{p.desc||p.description}</p><div><strong>{money(p.price)}</strong><button onClick={()=>add(p)} aria-label={`Agregar ${p.name}`}><Plus/></button></div></div></article>}

function MenuPage({catalog,add,branch,setBranch,cartCount,cartTotal}){
  const nav=useNavigate(); const [params]=useSearchParams(); const initial=params.get('category')||'Favoritos'; const [cat,setCat]=useState(initial); const [q,setQ]=useState('')
  const categoryList=['Favoritos',...catalog.categories]
  const shown=useMemo(()=>catalog.products.filter(p=>p.available!==false).filter(p=>cat==='Favoritos'?p.featured:p.category===cat).filter(p=>(p.name+' '+(p.desc||'')).toLowerCase().includes(q.toLowerCase())),[catalog.products,cat,q])
  return <main><Header branch={branch} setBranch={setBranch} branches={catalog.branches}/><section className="menu-head"><span className="eyebrow dark">MENÚ KYO</span><h1>¿Qué se te antoja?</h1><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar ramen, rollos, entradas..."/></div></section><div className="category-tabs">{categoryList.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>{catalog.loading?<div className="loading-state"><RefreshCw className="spin"/> Cargando menú...</div>:<section className="menu-grid">{shown.map(p=><ProductCard key={p.id} p={p} add={add}/>)}</section>}{shown.length===0&&!catalog.loading&&<EmptyState icon={<Search/>} title="No encontramos productos" text="Prueba otra categoría o búsqueda." button="Ver favoritos" onClick={()=>setCat('Favoritos')}/>} {cartCount>0&&<button className="floating-cart" onClick={()=>nav('/cart')}><ShoppingBag size={20}/><span>Ver carrito · {money(cartTotal)}</span><b>{cartCount}</b></button>}</main>
}

function LoginPage({auth}){
  const nav=useNavigate(); const [mode,setMode]=useState('login'); const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  useEffect(()=>{if(auth.user) nav('/',{replace:true})},[auth.user])
  const submit=async e=>{e.preventDefault();setError(''); if(!supabase){setError('Falta configurar Supabase en las variables de entorno.');return} setBusy(true)
    const result=mode==='register'
      ? await supabase.auth.signUp({email,password,options:{data:{full_name:name}}})
      : await supabase.auth.signInWithPassword({email,password})
    setBusy(false); if(result.error){setError(result.error.message);return}
    if(mode==='register'&&!result.data.session){setError('Cuenta creada. Revisa tu correo para confirmar el acceso.');return}
    nav('/')
  }
  return <main className="auth-page"><button className="back" onClick={()=>nav(-1)}><ArrowLeft/></button><div className="auth-brand"><Brand/><p>Tu KYO. Tus rewards. Tu pedido.</p></div><form className="auth-card" onSubmit={submit}><div className="auth-tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Iniciar sesión</button><button type="button" className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Crear cuenta</button></div>{mode==='register'&&<label>Nombre<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label>}<label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label><label>Contraseña<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>{error&&<div className="form-message">{error}</div>}<button disabled={busy} className="primary full">{busy?'Procesando...':mode==='login'?'Entrar a mi cuenta':'Crear mi cuenta'}</button><button type="button" className="forgot" onClick={async()=>{if(email&&supabase){await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/login'});setError('Te enviamos un correo para recuperar tu contraseña.')}}}>¿Olvidaste tu contraseña?</button></form></main>
}

function ProfilePage({auth}){
  const nav=useNavigate(); const [addresses,setAddresses]=useState([]); const [newAddress,setNewAddress]=useState('')
  const load=async()=>{if(!supabase||!auth.user)return; const {data}=await supabase.from('addresses').select('*').eq('user_id',auth.user.id).order('created_at'); setAddresses(data||[])}
  useEffect(()=>{load()},[auth.user])
  if(!auth.user)return <main><Header plain/><section className="page-intro"><span className="eyebrow dark">MI KYO</span><h1>Tu cuenta KYO</h1><p>Inicia sesión para guardar direcciones, ver pedidos y acumular rewards.</p><button className="primary dark-btn" onClick={()=>nav('/login')}>Iniciar sesión</button></section><GuestBenefits/></main>
  const addAddress=async()=>{if(!newAddress.trim())return; const {data,error}=await supabase.from('addresses').insert({user_id:auth.user.id,label:'Dirección',address_line:newAddress.trim()}).select().single(); if(!error){setAddresses(a=>[...a,data]);setNewAddress('')}}
  return <main><Header plain/><section className="profile-hero"><div className="avatar">{(auth.profile?.full_name||auth.user.email||'K')[0].toUpperCase()}</div><div><small>HOLA,</small><h1>{auth.profile?.full_name||'Cliente KYO'}</h1><p>{auth.user.email}</p></div></section><section className="profile-stats"><div><strong>{auth.profile?.reward_points||0}</strong><small>KYO Points</small></div><div><strong>{addresses.length}</strong><small>Direcciones</small></div></section><section className="section"><div className="section-head"><div><span className="eyebrow dark">DIRECCIONES</span><h2>Mis direcciones</h2></div></div><div className="address-list">{addresses.map(a=><div className="address-option active" key={a.id}><MapPin/><span><strong>{a.label}</strong><small>{a.address_line}</small></span><button onClick={async()=>{await supabase.from('addresses').delete().eq('id',a.id);setAddresses(v=>v.filter(x=>x.id!==a.id))}}><Trash2 size={17}/></button></div>)}<label className="new-address"><Navigation size={18}/><input value={newAddress} onChange={e=>setNewAddress(e.target.value)} placeholder="Agregar nueva dirección"/><button onClick={addAddress} type="button"><Plus/></button></label></div></section><section className="profile-menu"><button><span><Settings/> Preferencias</span><ChevronRight/></button><button className="logout" onClick={()=>supabase.auth.signOut()}><span><LogOut/> Cerrar sesión</span></button></section></main>
}
function GuestBenefits(){return <section className="section"><div className="benefit-boxes"><div><Gift/><strong>Rewards exclusivos</strong><p>Acumula puntos en pedidos entregados.</p></div><div><MapPin/><strong>Direcciones guardadas</strong><p>Pide en menos pasos la próxima vez.</p></div><div><ShoppingBag/><strong>Historial completo</strong><p>Consulta todos tus pedidos.</p></div></div></section>}

function RewardsPage({auth}){const nav=useNavigate(); if(!auth.user)return <main><Header plain/><EmptyState icon={<Gift/>} title="Tus rewards viven aquí" text="Inicia sesión para acumular KYO Points." button="Iniciar sesión" onClick={()=>nav('/login')}/></main>; const points=auth.profile?.reward_points||0; return <main><Header plain/><section className="page-intro"><span className="eyebrow dark">KYO REWARDS</span><h1>{points} puntos</h1><p>Ganas 1 punto por cada $1 de subtotal cuando tu pedido se marca como entregado.</p></section><section className="reward-banner"><div><span className="reward-icon"><Gift/></span><span><small>TU SALDO</small><strong>{points} KYO Points</strong></span></div></section></main>}

function OrdersPage({auth}){
  const nav=useNavigate(); const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(true)
  const load=async()=>{if(!supabase||!auth.user){setLoading(false);return} const {data}=await supabase.from('orders').select('*, order_items(*)').eq('user_id',auth.user.id).order('created_at',{ascending:false}); setOrders(data||[]);setLoading(false)}
  useEffect(()=>{load()},[auth.user])
  if(!auth.user)return <main><Header plain/><EmptyState icon={<ShoppingBag/>} title="Tus pedidos en un solo lugar" text="Inicia sesión para ver tu historial y seguimiento." button="Iniciar sesión" onClick={()=>nav('/login')}/></main>
  return <main><Header plain/><section className="page-intro compact"><span className="eyebrow dark">MIS PEDIDOS</span><h1>Historial</h1></section>{loading?<div className="loading-state"><RefreshCw className="spin"/> Cargando...</div>:<section className="orders">{orders.map(o=><article key={o.id}><div><span className={`status ${o.status==='delivered'?'completed':''}`}><Check size={15}/> {statusLabels[o.status]||o.status}</span><small>{new Date(o.created_at).toLocaleDateString('es-MX')} · {o.branch_id==='zakia'?'KYO Zákia':'KYO Milenio'}</small></div><h3>Pedido #{String(o.order_number).padStart(4,'0')}</h3><p>{o.order_items?.map(i=>`${i.quantity}× ${i.product_name}`).join(' · ')}</p><div><strong>{money(o.total)}</strong></div></article>)}{orders.length===0&&<EmptyState icon={<ShoppingBag/>} title="Aún no tienes pedidos" text="Tu primer KYO está a unos toques." button="Ver menú" onClick={()=>nav('/menu')}/>}</section>}</main>
}

function CartPage({cart,update,total,branch}){const nav=useNavigate();return <main><div className="simple-head"><button onClick={()=>nav(-1)}><ArrowLeft/></button><h1>Tu pedido</h1><span/></div>{cart.length===0?<EmptyState icon={<ShoppingBag/>} title="Tu carrito está vacío" text="Hay mucho KYO esperándote." button="Ver menú" onClick={()=>nav('/menu')}/>:<><section className="cart-branch"><MapPin/><div><small>Pedido desde</small><strong>{branch?.name}</strong><span>{branch?.eta}</span></div></section><section className="cart-items">{cart.map(i=><article key={i.id}><img src={i.image||i.image_url}/><div className="cart-info"><h3>{i.name}</h3><p>{i.desc||i.description}</p><strong>{money(i.price)}</strong></div><div className="qty"><button onClick={()=>update(i.id,-1)}>{i.qty===1?<Trash2 size={16}/>:<Minus size={16}/>}</button><b>{i.qty}</b><button onClick={()=>update(i.id,1)}><Plus size={16}/></button></div></article>)}</section><section className="summary"><div><span>Subtotal</span><strong>{money(total)}</strong></div><div><span>Envío</span><strong>$39</strong></div><div className="total"><span>Total</span><strong>{money(total+39)}</strong></div></section><div className="checkout-bar"><button className="primary full" onClick={()=>nav('/checkout')}>Continuar · {money(total+39)}</button></div></>}</main>}

function CheckoutPage({cart,total,auth,branch,setCart}){
  const nav=useNavigate(); const [type,setType]=useState('delivery'); const [payment,setPayment]=useState('cash'); const [addresses,setAddresses]=useState([]); const [selected,setSelected]=useState(''); const [notes,setNotes]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  useEffect(()=>{if(auth.user&&supabase) supabase.from('addresses').select('*').eq('user_id',auth.user.id).order('is_default',{ascending:false}).then(({data})=>{setAddresses(data||[]);setSelected(data?.[0]?.id||'')})},[auth.user])
  if(!auth.user)return <Navigate to="/login" replace/>
  const finish=async()=>{setError('');if(!supabase)return setError('Supabase no está configurado.');if(!cart.length)return; if(type==='delivery'&&!selected)return setError('Selecciona una dirección de entrega.'); setBusy(true)
    const address=addresses.find(a=>a.id===selected); const fee=type==='delivery'?39:0
    const items=cart.map(i=>({product_id:i.id,quantity:i.qty}))
    const {data,error:e1}=await supabase.rpc('create_order',{p_branch_id:branch.id,p_fulfillment_type:type,p_delivery_address:type==='delivery'?address?.address_line:null,p_delivery_notes:notes,p_payment_method:payment,p_items:items})
    setBusy(false); if(e1){setError(e1.message);return} const order=Array.isArray(data)?data[0]:data; setCart([]); nav('/success',{state:{orderNumber:order?.order_number}})
  }
  return <main className="checkout-page"><div className="simple-head"><button onClick={()=>nav(-1)}><ArrowLeft/></button><h1>Finalizar pedido</h1><span/></div><section className="checkout-section"><h2>¿Cómo quieres tu pedido?</h2><div className="type-toggle"><button onClick={()=>setType('delivery')} className={type==='delivery'?'active':''}><Bike/><span><strong>Delivery</strong><small>{branch?.eta}</small></span></button><button onClick={()=>setType('pickup')} className={type==='pickup'?'active':''}><Store/><span><strong>Recoger</strong><small>20–30 min</small></span></button></div></section>{type==='delivery'&&<section className="checkout-section"><h2>Dirección de entrega</h2>{addresses.map(a=><button className={`address-option ${selected===a.id?'active':''}`} onClick={()=>setSelected(a.id)} key={a.id}><MapPin/><span><strong>{a.label}</strong><small>{a.address_line}</small></span>{selected===a.id&&<Check/>}</button>)}{addresses.length===0&&<button className="save-login" onClick={()=>nav('/profile')}>Agrega una dirección en tu perfil</button>}</section>}<section className="checkout-section"><h2>Método de pago</h2><button className={`pay-option ${payment==='card'?'active':''}`} onClick={()=>setPayment('card')}><CreditCard/><span><strong>Tarjeta</strong><small>Integración de pasarela pendiente</small></span>{payment==='card'&&<Check/>}</button><button className={`pay-option ${payment==='cash'?'active':''}`} onClick={()=>setPayment('cash')}><Banknote/><span><strong>Efectivo</strong><small>Paga al recibir tu pedido</small></span>{payment==='cash'&&<Check/>}</button><label className="admin-field"><span>Notas del pedido</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sin cebolla, tocar timbre..."/></label></section>{error&&<div className="form-message checkout-message">{error}</div>}<section className="summary checkout-summary"><div><span>Productos ({cart.reduce((a,i)=>a+i.qty,0)})</span><strong>{money(total)}</strong></div>{type==='delivery'&&<div><span>Envío</span><strong>$39</strong></div>}<div className="total"><span>Total</span><strong>{money(total+(type==='delivery'?39:0))}</strong></div></section><div className="checkout-bar"><button disabled={busy} className="primary full" onClick={finish}>{busy?'Enviando pedido...':`Confirmar pedido · ${money(total+(type==='delivery'?39:0))}`}</button></div></main>
}

function SuccessPage(){const nav=useNavigate();const loc=useLocation();return <main className="success"><div className="success-check"><Check/></div><span className="eyebrow dark">¡PEDIDO CONFIRMADO!</span><h1>Gracias por pedir KYO.</h1><p>{loc.state?.orderNumber?`Tu pedido #${String(loc.state.orderNumber).padStart(4,'0')} ya fue enviado a cocina.`:'Tu pedido ya fue enviado a cocina.'}</p><div className="order-progress"><div className="done"><i><Check/></i><span><strong>Pedido recibido</strong><small>Tu orden fue enviada a KYO</small></span></div><div><i>2</i><span><strong>Preparando tu pedido</strong><small>El negocio confirmará tu orden</small></span></div><div><i>3</i><span><strong>En camino</strong><small>Te avisaremos cuando salga</small></span></div></div><button className="primary dark-btn" onClick={()=>nav('/orders')}>Ver mis pedidos</button></main>}

function EmptyState({icon,title,text,button,onClick}){return <section className="empty"><span>{icon}</span><h2>{title}</h2><p>{text}</p><button className="primary dark-btn" onClick={onClick}>{button}</button></section>}
export default App
