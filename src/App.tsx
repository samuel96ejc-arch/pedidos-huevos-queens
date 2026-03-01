import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, Trash2, Calendar, 
  Search, LogOut, Bell, User, ShoppingCart, CheckCircle
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE (Con tu clave real) ---
const firebaseConfig = {
  apiKey: "AIzaSyDiWfZPVVDQqH4WB0ec1lfOU4w3BZ6Xrl0",
  authDomain: "huevos-queens.firebaseapp.com",
  projectId: "huevos-queens",
  storageBucket: "huevos-queens.firebasestorage.app",
  messagingSenderId: "131121347509",
  appId: "1:131121347509:web:115811e07073d2c7ccf7fc",
  measurementId: "G-NHR66VFBZQ"
};

// Inicializar servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONSTANTES DE LA APP ---
const TIPOS_HUEVO = ['Jumbo', 'AAA', 'AA', 'A', 'B', 'C', 'Rotos'];
const USUARIOS = [
  { nombre: 'Granja', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', iconColor: 'text-emerald-600', badge: 'bg-emerald-500' },
  { nombre: 'Yulia', color: 'bg-purple-100 text-purple-800 border-purple-300', iconColor: 'text-purple-600', badge: 'bg-purple-500' },
  { nombre: 'Samuel', color: 'bg-blue-100 text-blue-800 border-blue-300', iconColor: 'text-blue-600', badge: 'bg-blue-500' },
  { nombre: 'Merly', color: 'bg-orange-100 text-orange-800 border-orange-300', iconColor: 'text-orange-600', badge: 'bg-orange-500' }
];

export default function App() {
  // --- ESTADOS ---
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  
  // Estados Formulario Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Estados Formulario Pedido
  const [vendedorActivo, setVendedorActivo] = useState('');
  const [cliente, setCliente] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [tipoHuevo, setTipoHuevo] = useState('A');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [notificacion, setNotificacion] = useState('');

  // --- 1. AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    signInWithEmailAndPassword(auth, email, password)
      .catch(() => setLoginError("Credenciales incorrectas"));
  };

  // --- 2. SINCRONIZACIÓN EN TIEMPO REAL (FIREBASE) ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'pedidos_preventa'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pedidosArray = [];
      snapshot.forEach((doc) => {
        pedidosArray.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(pedidosArray);
    }, (error) => {
      console.error("Error BD:", error);
      if (error.code === 'permission-denied') {
        alert("⚠️ Recuerda actualizar las Reglas de Firestore en Firebase Console para la colección 'pedidos_preventa'.");
      }
    });
    return () => unsubscribe();
  }, [user]);

  // --- 3. GUARDAR PEDIDO ---
  const agregarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendedorActivo || !cliente || !cantidad || !fechaEntrega) return;

    try {
      await addDoc(collection(db, 'pedidos_preventa'), {
        vendedor: vendedorActivo,
        cliente: cliente,
        cantidad: Number(cantidad),
        tipo: tipoHuevo,
        fechaEntrega: fechaEntrega,
        timestamp: new Date().toISOString(),
      });

      setNotificacion('✅ Pedido Registrado Exitosamente');
      setTimeout(() => setNotificacion(''), 3000);
      
      // Limpiar formulario excepto el vendedor y la fecha
      setCliente('');
      setCantidad('');
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error al guardar el pedido. Verifica tu conexión o las reglas de Firebase.");
    }
  };

  // --- 4. BORRAR PEDIDO ---
  const borrarPedido = async (id: string) => {
    if(confirm("¿Estás seguro de eliminar este pedido?")) {
      try {
        await deleteDoc(doc(db, 'pedidos_preventa', id));
      } catch (error) {
        console.error("Error al borrar:", error);
      }
    }
  };

  // --- 5. ENVIAR NOTIFICACIÓN WHATSAPP ---
  const notificarWhatsApp = () => {
    const mensaje = `🚨 *NUEVO PEDIDO REGISTRADO* 🚨%0A👤 Vendedor: *${vendedorActivo}*%0A🤝 Cliente: *${cliente}*%0A📦 Cantidad: *${cantidad} cartones de ${tipoHuevo}*%0A📅 Para entregar el: *${fechaEntrega}*%0A%0A_Por favor actualizar el inventario disponible._`;
    const url = `https://wa.me/?text=${mensaje}`;
    window.open(url, '_blank');
  };

  // --- 6. CÁLCULOS ESTADÍSTICOS ---
  const totalCartones = useMemo(() => pedidos.reduce((sum: number, p: any) => sum + p.cantidad, 0), [pedidos]);
  
  const totalesPorVendedor = useMemo(() => {
    const totales: Record<string, number> = { Granja: 0, Yulia: 0, Samuel: 0, Merly: 0 };
    pedidos.forEach((p: any) => { 
      if (totales[p.vendedor] !== undefined) {
        totales[p.vendedor] += p.cantidad; 
      }
    });
    return totales;
  }, [pedidos]);

  // --- PANTALLA DE CARGA Y LOGIN ---
  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-500"></div></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border-t-8 border-yellow-500">
          
          {/* AQUÍ VA TU LOGO EN EL LOGIN */}
          <div className="flex justify-center mb-6">
            <img 
              src="/logo.jpg" 
              alt="Logo Huevos Queens" 
              className="h-32 object-contain drop-shadow-md"
              onError={(e: any) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=Falta+Logo' }} 
            />
          </div>

          <h1 className="text-2xl font-black text-center text-slate-800 mb-2">Pedidos Huevos Queens</h1>
          <p className="text-center text-gray-500 text-sm mb-6 font-medium">Sistema de Preventas</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
              <input type="email" placeholder="usuario@correo.com" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Contraseña</label>
              <input type="password" placeholder="••••••••" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold text-center bg-red-50 p-2 rounded-lg">{loginError}</p>}
            <button type="submit" className="w-full bg-yellow-500 text-slate-900 font-black py-4 rounded-xl hover:bg-yellow-600 transition-all shadow-md mt-4 text-lg">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  // --- APLICACIÓN PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-100 p-2 md:p-6 font-sans">
      
      {/* ALERTA FLOTANTE */}
      {notificacion && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold animate-bounce flex items-center gap-2">
          <CheckCircle size={20} /> {notificacion}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* CABECERA */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-center border border-gray-200 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            
            {/* AQUÍ VA TU LOGO EN LA APP */}
            <img 
              src="/logo.jpg" 
              alt="Logo Huevos Queens" 
              className="h-16 object-contain drop-shadow-sm"
              onError={(e: any) => { e.currentTarget.src = 'https://via.placeholder.com/64?text=Logo' }} 
            />

            <div>
              <h1 className="text-2xl font-black text-slate-800">Control de Preventas</h1>
              <p className="text-sm text-yellow-600 font-bold flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Sincronizado en Tiempo Real</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold w-full md:w-auto justify-center transition-colors">
            <LogOut size={18}/> Salir
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500"></div>
              <h2 className="font-black text-slate-800 text-xl mb-5 flex items-center gap-2"><PlusCircle className="text-yellow-500"/> Registrar Nuevo Pedido</h2>
              
              <form onSubmit={agregarPedido} className="space-y-5">
                {/* SELECCIÓN DE USUARIO */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 block">1. ¿Quién registra el pedido?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {USUARIOS.map(u => (
                      <button 
                        key={u.nombre} type="button" 
                        onClick={() => setVendedorActivo(u.nombre)}
                        className={`p-3 rounded-xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 ${vendedorActivo === u.nombre ? u.badge + ' text-white border-transparent shadow-lg scale-105' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                      >
                        <User size={16}/> {u.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {vendedorActivo && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Nombre del Cliente / Negocio</label>
                      <input type="text" required className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-medium text-slate-700" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ej: Tienda Don Pepe" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Cantidad (Cartones)</label>
                        <input type="number" required min="1" className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-black text-slate-800 text-lg text-center" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="#" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Tipo de Huevo</label>
                        <select className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-bold text-slate-700 cursor-pointer" value={tipoHuevo} onChange={e => setTipoHuevo(e.target.value)}>
                          {TIPOS_HUEVO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Para entregar el (Día)</label>
                      <input type="date" required className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-bold text-slate-700 cursor-pointer" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                    </div>
                    
                    <div className="pt-4 border-t border-gray-100 flex gap-3">
                      <button type="submit" className="flex-1 bg-slate-800 text-white font-black py-4 rounded-xl hover:bg-slate-900 shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 text-lg">
                         <ShoppingCart size={20}/> Guardar Pedido
                      </button>
                      
                      {/* BOTÓN MÁGICO DE WHATSAPP */}
                      {(cliente && cantidad && fechaEntrega) && (
                        <button type="button" onClick={notificarWhatsApp} className="bg-green-500 text-white p-4 rounded-xl hover:bg-green-600 shadow-xl transition-transform active:scale-95 flex items-center justify-center" title="Enviar aviso al grupo de WhatsApp">
                          <Bell size={24}/>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* RESUMEN TOTALES */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700">
              <div className="absolute -right-4 -top-4 opacity-5 text-yellow-500"><ShoppingCart size={150}/></div>
              <h3 className="text-sm text-yellow-400 font-bold uppercase tracking-wider mb-2 relative z-10 flex items-center gap-2"><CheckCircle size={16}/> Resumen General</h3>
              <div className="flex items-baseline gap-2 mb-6 relative z-10 border-b border-slate-700 pb-4">
                 <span className="text-5xl font-black text-white drop-shadow-lg">{totalCartones}</span>
                 <span className="text-xl text-slate-400 font-medium">Cartones Pedidos</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 relative z-10">
                {USUARIOS.map(u => (
                  <div key={u.nombre} className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-600 shadow-inner">
                    <span className="font-bold text-sm flex items-center gap-2"><div className={`w-3 h-3 rounded-full shadow-sm ${u.badge}`}></div> {u.nombre}</span>
                    <span className="font-black text-xl text-slate-200">{totalesPorVendedor[u.nombre]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: LISTA DE PEDIDOS */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col min-h-[600px]">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-100 pb-4">
               <h2 className="font-black text-slate-800 text-xl flex items-center gap-2"><Calendar className="text-blue-500"/> Pedidos Activos ({pedidos.length})</h2>
               <div className="relative w-full sm:w-64">
                 <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                 <input type="text" placeholder="Buscar cliente..." className="w-full pl-10 p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-medium transition-all" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
               </div>
             </div>

             <div className="flex-1 overflow-auto pr-2 space-y-4 custom-scrollbar">
                {pedidos.filter(p => p.cliente.toLowerCase().includes(busqueda.toLowerCase())).map(pedido => {
                  const perfil = USUARIOS.find(u => u.nombre === pedido.vendedor) || USUARIOS[0];
                  // Formatear la fecha (hora de registro)
                  const fechaRegistro = new Date(pedido.timestamp).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });

                  return (
                    <div key={pedido.id} className={`p-5 rounded-2xl border-l-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md bg-white border ${perfil.color.split(' ')[2]} hover:scale-[1.01]`}>
                       <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full text-white shadow-sm ${perfil.badge}`}>{pedido.vendedor}</span>
                             <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Calendar size={12}/> Registrado: {fechaRegistro}</span>
                          </div>
                          <h3 className="font-black text-xl text-slate-800 mb-1">{pedido.cliente}</h3>
                          <p className="text-sm text-slate-600 font-medium bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">
                            🚚 Entregar el: <span className="font-black text-slate-800">{pedido.fechaEntrega}</span>
                          </p>
                       </div>
                       
                       <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100 mt-2 sm:mt-0">
                          <div className={`text-center px-6 py-3 rounded-xl ${perfil.color} border-none shadow-sm`}>
                            <p className="text-3xl font-black">{pedido.cantidad}</p>
                            <p className="text-[11px] font-black uppercase tracking-wider opacity-80 mt-1">CARTONES {pedido.tipo}</p>
                          </div>
                          <button onClick={() => borrarPedido(pedido.id)} className="p-3 bg-gray-50 rounded-xl hover:bg-red-500 hover:text-white transition-colors text-gray-400 border border-gray-200 shadow-sm" title="Eliminar este pedido"><Trash2 size={20}/></button>
                       </div>
                    </div>
                  );
                })}

                {pedidos.length === 0 && (
                  <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                    <div className="bg-gray-50 p-6 rounded-full mb-4"><ShoppingCart size={64} className="text-gray-300"/></div>
                    <p className="font-black text-xl text-slate-700">Aún no hay pedidos activos</p>
                    <p className="text-sm text-gray-500 mt-2 max-w-xs">Selecciona un usuario en el panel izquierdo para comenzar a registrar preventas.</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}