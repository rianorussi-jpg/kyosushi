import React, { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, LayoutDashboard, Utensils, LogOut, Plus, Package, MapPin, Clock3, Pencil, X, Upload, Trash2, Save } from 'lucide-react'
import { supabase, MENU_BUCKET } from '../supabase'

const money = n => `$${Number(n || 0).toLocaleString('es-MX', {maximumFractionDigits: 2})}`
const statusLabels = {
  received:'Recibido', accepted:'Aceptado', preparing:'Preparando', ready:'Listo',
  on_the_way:'En camino', delivered:'Entregado', cancelled:'Cancelado'
}

function Brand(){return <div className="brand"><span className="brand-mark">KYO</span><span className="brand-sub">JAPANESE SOUL FOOD</span></div>}

export function AdminGate({auth,children}){
  if(auth.loading)return <main className="admin-login"><RefreshCw className="spin"/><p>Comprobando sesión...</p></main>
  if(!auth.user)return <AdminLogin/>
  if(!auth.profile?.is_admin)return <main className="admin-login"><ShieldCheck size={44}/><h1>Cuenta sin acceso al panel</h1><p>Este usuario existe, pero no está marcado como administrador.</p><button className="primary dark-btn" onClick={()=>supabase?.auth.signOut()}>Cerrar sesión</button></main>
  return children
}

function AdminLogin(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  const submit=async e=>{e.preventDefault();if(!supabase)return setError('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.');setBusy(true);const {error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError(error.message)}
  return <main className="admin-login"><div className="admin-login-card"><Brand/><span className="admin-pill">PANEL ADMINISTRATIVO</span><h1>Control de KYO</h1><p>Ingresa con el correo y contraseña de administración.</p><form onSubmit={submit}><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="form-message">{error}</div>}<button className="primary full" disabled={busy}>{busy?'Entrando...':'Entrar al panel'}</button></form></div></main>
}

export function AdminPanel({auth,catalog}){
  const [tab,setTab]=useState('orders'); const [orders,setOrders]=useState([]); const [editing,setEditing]=useState(null); const [creating,setCreating]=useState(false)
  const loadOrders=async()=>{if(!supabase)return; const {data}=await supabase.from('orders').select('*, order_items(*), profiles(full_name)').order('created_at',{ascending:false}).limit(100);setOrders(data||[])}
  useEffect(()=>{loadOrders(); if(!supabase) return; const ch=supabase.channel('admin-orders').on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadOrders).subscribe(); return ()=>{supabase.removeChannel(ch)}},[])
  const updateStatus=async(id,status)=>{await supabase.from('orders').update({status}).eq('id',id);loadOrders();if(status==='delivered')auth.refreshProfile()}
  return <main className="admin-shell"><aside className="admin-side"><Brand/><div className="admin-user"><div>{(auth.profile?.full_name||'A')[0]}</div><span><strong>{auth.profile?.full_name||'Administrador'}</strong><small>{auth.user.email}</small></span></div><nav><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><LayoutDashboard/> Pedidos</button><button className={tab==='menu'?'active':''} onClick={()=>setTab('menu')}><Utensils/> Menú</button></nav><button className="admin-logout" onClick={()=>supabase.auth.signOut()}><LogOut/> Cerrar sesión</button></aside><section className="admin-main"><header><div><span>KYO CONTROL</span><h1>{tab==='orders'?'Pedidos':'Menú'}</h1></div>{tab==='menu'&&<button className="primary" onClick={()=>setCreating(true)}><Plus/> Nuevo producto</button>}</header>{tab==='orders'?<AdminOrders orders={orders} updateStatus={updateStatus}/>:<AdminMenu catalog={catalog} onEdit={setEditing}/>}</section>{(editing||creating)&&<ProductEditor product={editing} categories={catalog.categories} onClose={()=>{setEditing(null);setCreating(false)}} onSaved={()=>{setEditing(null);setCreating(false);catalog.refresh()}}/>}</main>
}

function AdminOrders({orders,updateStatus}){return <div className="admin-orders">{orders.length===0?<div className="admin-empty"><Package/><h3>No hay pedidos todavía</h3><p>Los pedidos nuevos aparecerán aquí en tiempo real.</p></div>:orders.map(o=><article key={o.id}><div className="admin-order-top"><span><small>PEDIDO</small><strong>#{String(o.order_number).padStart(4,'0')}</strong></span><span className={`admin-status ${o.status}`}>{statusLabels[o.status]}</span><span><small>CLIENTE</small><strong>{o.profiles?.full_name||'Cliente KYO'}</strong></span><span><small>TOTAL</small><strong>{money(o.total)}</strong></span></div><p>{o.order_items?.map(i=>`${i.quantity}× ${i.product_name}`).join(' · ')}</p><div className="admin-order-meta"><span><MapPin/> {o.branch_id==='zakia'?'Zákia':'Milenio'} · {o.fulfillment_type==='delivery'?'Delivery':'Pickup'}</span><span><Clock3/> {new Date(o.created_at).toLocaleString('es-MX')}</span></div><div className="status-actions">{['accepted','preparing','ready','on_the_way','delivered','cancelled'].map(s=><button key={s} className={o.status===s?'active':''} onClick={()=>updateStatus(o.id,s)}>{statusLabels[s]}</button>)}</div></article>)}</div>}
function AdminMenu({catalog,onEdit}){return <div className="admin-product-grid">{catalog.products.map(p=><article key={p.id} className={!p.available?'disabled':''}><img src={p.image||p.image_url}/><div><small>{p.category}</small><h3>{p.name}</h3><strong>{money(p.price)}</strong><span>{p.available?'Disponible':'Agotado'}</span></div><button onClick={()=>onEdit(p)}><Pencil/></button></article>)}</div>}

function ProductEditor({product,categories,onClose,onSaved}){
  const [form,setForm]=useState({name:product?.name||'',description:product?.description||product?.desc||'',price:product?.price||'',category:product?.category||categories[0]||'Entradas',image_url:product?.image_url||product?.image||'',featured:!!product?.featured,spicy:!!product?.spicy,available:product?.available!==false})
  const [file,setFile]=useState(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  const save=async()=>{setBusy(true);setError('');let imageUrl=form.image_url
    if(file){const ext=file.name.split('.').pop();const path=`products/${crypto.randomUUID()}.${ext}`;const {error:up}=await supabase.storage.from(MENU_BUCKET).upload(path,file,{upsert:false});if(up){setError(up.message);setBusy(false);return} imageUrl=supabase.storage.from(MENU_BUCKET).getPublicUrl(path).data.publicUrl}
    const {data:cat}=await supabase.from('categories').select('id').eq('name',form.category).single();
    const payload={name:form.name,slug:product?.slug||form.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),description:form.description,price:Number(form.price),category_id:cat?.id||null,image_url:imageUrl,featured:form.featured,spicy:form.spicy,available:form.available}
    const result=product?.id ? await supabase.from('products').update(payload).eq('id',product.id) : await supabase.from('products').insert(payload)
    setBusy(false);if(result.error){setError(result.error.message);return}onSaved()
  }
  const remove=async()=>{if(!product?.id||!confirm('¿Eliminar este producto?'))return;await supabase.from('products').delete().eq('id',product.id);onSaved()}
  return <div className="modal-backdrop"><div className="product-editor"><div className="modal-head"><div><small>{product?'EDITAR PRODUCTO':'NUEVO PRODUCTO'}</small><h2>{product?.name||'Agregar al menú'}</h2></div><button onClick={onClose}><X/></button></div><div className="editor-grid"><label className="admin-field"><span>Nombre</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="admin-field"><span>Precio</span><input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label className="admin-field"><span>Categoría</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="admin-field full-span"><span>Descripción</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="image-upload full-span"><Upload/><span><strong>Subir nueva foto</strong><small>JPG, PNG o WebP. Se guardará en Supabase Storage.</small></span><input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{(file||form.image_url)&&<img className="editor-preview" src={file?URL.createObjectURL(file):form.image_url}/>}<div className="editor-toggles full-span"><label><input type="checkbox" checked={form.available} onChange={e=>setForm({...form,available:e.target.checked})}/> Disponible</label><label><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Favorito</label><label><input type="checkbox" checked={form.spicy} onChange={e=>setForm({...form,spicy:e.target.checked})}/> Spicy</label></div></div>{error&&<div className="form-message">{error}</div>}<div className="modal-actions">{product&&<button className="danger-btn" onClick={remove}><Trash2/> Eliminar</button>}<button className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy} onClick={save}><Save/> {busy?'Guardando...':'Guardar producto'}</button></div></div></div>
}
