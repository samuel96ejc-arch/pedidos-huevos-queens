import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, Trash2, Calendar, 
  Search, LogOut, Bell, User, ShoppingCart, CheckCircle,
  MapPin, Phone, FileText, Clock, ChevronDown, ChevronUp, Edit, ListPlus, MinusCircle, X
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vendedorActivo, setVendedorActivo] = useState('');
  const [cliente, setCliente] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  
  // Múltiples items en un pedido
  const [carritoItems, setCarritoItems] = useState<any[]>([]);
  const [cantidadInput, setCantidadInput] = useState('');
  const [tipoHuevoInput, setTipoHuevoInput] = useState('A');

  // Opcionales
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notasExtra, setNotasExtra] = useState('');

  // Buscador y notificaciones
  const [busqueda, setBusqueda] = useState('');
  const [notificacion, setNotificacion] = useState('');
  
  // Acordeones de fechas
  const [fechasExpandidas, setFechasExpandidas] = useState<string[]>([]);

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
      const pedidosArray: any[] = [];
      snapshot.forEach((doc) => {
        pedidosArray.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(pedidosArray);
    }, (error) => {
      console.error("Error BD:", error);
      if (error.code === 'permission-denied') {
        alert("⚠️ Recuerda actualizar las Reglas de Firestore.");
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Expandir todas las fechas automáticamente al cargar la primera vez
  useEffect(() => {
    if (pedidos.length > 0 && fechasExpandidas.length === 0) {
      const fechasUnicas = Array.from(new Set(pedidos.map(p => p.fechaEntrega)));
      setFechasExpandidas(fechasUnicas as string[]);
    }
  }, [pedidos]);

  // --- FUNCIONES AUXILIARES ---
  const obtenerNombreDia = (fechaString: string) => {
    if (!fechaString) return '';
    const [year, month, day] = fechaString.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[date.getDay()];
  };

  const toggleFecha = (fecha: string) => {
    if (fechasExpandidas.includes(fecha)) {
      setFechasExpandidas(fechasExpandidas.filter(f => f !== fecha));
    } else {
      setFechasExpandidas([...fechasExpandidas, fecha]);
    }
  };

  // --- CARRITO MULTI-REFERENCIA ---
  const agregarItemAlCarrito = () => {
    if (!cantidadInput) return;
    setCarritoItems([...carritoItems, { id: Date.now().toString(), tipo: tipoHuevoInput, cantidad: Number(cantidadInput) }]);
    setCantidadInput('');
  };

  const removerItemDelCarrito = (id: string) => {
    setCarritoItems(carritoItems.filter(item => item.id !== id));
  };

  // --- 3. GUARDAR / ACTUALIZAR PEDIDO ---
  const guardarPedidoFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendedorActivo || !cliente || !fechaEntrega) return;

    // Si el usuario escribió una cantidad pero olvidó darle al '+'
    let itemsFinales = [...carritoItems];
    if (itemsFinales.length === 0) {
      if (cantidadInput) {
        itemsFinales.push({ id: Date.now().toString(), tipo: tipoHuevoInput, cantidad: Number(cantidadInput) });
        setCantidadInput('');
      } else {
        alert("⚠️ Debes agregar al menos una referencia de huevo (Cantidad y Tipo) al pedido.");
        return;
      }
    }

    const data: any = {
      vendedor: vendedorActivo,
      cliente: cliente,
      fechaEntrega: fechaEntrega,
      direccion: direccion, 
      telefono: telefono,   
      notasExtra: notasExtra,
      items: itemsFinales, // Guardamos el arreglo de items
      estado: editandoId ? (pedidos.find(p => p.id === editandoId)?.estado || 'pendiente') : 'pendiente',
    };

    try {
      if (editandoId) {
        // ACTUALIZAR
        await updateDoc(doc(db, 'pedidos_preventa', editandoId), data);
        setNotificacion('✅ Pedido Actualizado Correctamente');
      } else {
        // CREAR NUEVO
        data.timestamp = new Date().toISOString();
        await addDoc(collection(db, 'pedidos_preventa'), data);
        setNotificacion('✅ Pedido Registrado Exitosamente');
        
        // Auto-expandir la fecha si es nueva
        if (!fechasExpandidas.includes(fechaEntrega)) {
           setFechasExpandidas([...fechasExpandidas, fechaEntrega]);
        }
      }
      setTimeout(() => setNotificacion(''), 3000);
      
      // Limpiar formulario y salir de modo edición
      setEditandoId(null);
      setCliente('');
      setCarritoItems([]);
      setCantidadInput('');
      setDireccion('');
      setTelefono('');
      setNotasExtra('');
    } catch (error) {
      console.error("Error guardando:", error);
      alert("Error al guardar. Verifica tu conexión.");
    }
  };

  // --- CARGAR DATOS PARA EDITAR ---
  const cargarParaEditar = (pedido: any) => {
    setEditandoId(pedido.id);
    setVendedorActivo(pedido.vendedor);
    setCliente(pedido.cliente);
    setFechaEntrega(pedido.fechaEntrega);
    setTelefono(pedido.telefono || '');
    setDireccion(pedido.direccion || '');
    setNotasExtra(pedido.notasExtra || '');
    
    // Compatibilidad: si el pedido es antiguo (solo cantidad/tipo), lo convertimos a lista
    const itemsDelPedido = pedido.items || [{ id: Date.now().toString(), tipo: pedido.tipo, cantidad: pedido.cantidad }];
    setCarritoItems(itemsDelPedido);
    setCantidadInput('');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setCliente('');
    setCarritoItems([]);
    setCantidadInput('');
    setDireccion('');
    setTelefono('');
    setNotasExtra('');
  };

  // --- 4. BORRAR PEDIDO ---
  const borrarPedido = async (id: string) => {
    if(confirm("¿Estás seguro de eliminar este pedido completamente?")) {
      try {
        await deleteDoc(doc(db, 'pedidos_preventa', id));
        if (editandoId === id) cancelarEdicion();
      } catch (error) {
        console.error("Error al borrar:", error);
      }
    }
  };

  // --- CAMBIAR ESTADO A ENTREGADO ---
  const cambiarEstadoPedido = async (id: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'entregado' ? 'pendiente' : 'entregado';
    
    const mensajeConfirmacion = estadoActual === 'entregado' 
      ? "¿Seguro que quieres regresar este pedido a PENDIENTE?" 
      : "¿Confirmas que este pedido ya fue ENTREGADO?";

    if(confirm(mensajeConfirmacion)) {
      try {
        await updateDoc(doc(db, 'pedidos_preventa', id), { estado: nuevoEstado });
      } catch (error) {
        console.error("Error al actualizar estado:", error);
      }
    }
  };

  // --- 5. ENVIAR NOTIFICACIÓN WHATSAPP ---
  const notificarWhatsApp = () => {
    let itemsParaMensaje = [...carritoItems];
    if (itemsParaMensaje.length === 0 && cantidadInput) {
       itemsParaMensaje.push({ tipo: tipoHuevoInput, cantidad: cantidadInput });
    }

    let mensaje = `🚨 *${editandoId ? 'ACTUALIZACIÓN DE PEDIDO' : 'NUEVO PEDIDO REGISTRADO'}* 🚨%0A`;
    mensaje += `👤 Vendedor: *${vendedorActivo}*%0A`;
    mensaje += `🤝 Cliente: *${cliente}*%0A`;
    mensaje += `📅 Para entregar el: *${obtenerNombreDia(fechaEntrega)}, ${fechaEntrega}*%0A%0A`;
    
    mensaje += `📦 *DETALLE DEL PEDIDO:*%0A`;
    itemsParaMensaje.forEach(i => {
       mensaje += `- ${i.cantidad} cartones de ${i.tipo}%0A`;
    });

    if (telefono || direccion || notasExtra) mensaje += `%0A`;
    if (telefono) mensaje += `📱 Teléfono: ${telefono}%0A`;
    if (direccion) mensaje += `📍 Dirección: ${direccion}%0A`;
    if (notasExtra) mensaje += `📝 Notas: ${notasExtra}%0A`;
    
    mensaje += `%0A_Por favor actualizar el inventario disponible._`;
    
    const url = `https://wa.me/?text=${mensaje}`;
    window.open(url, '_blank');
  };

  // --- 6. CÁLCULOS ESTADÍSTICOS (Compatibles con Múltiples Items y Antiguos) ---
  const totalCartones = useMemo(() => pedidos.reduce((sum: number, p: any) => {
    const items = p.items || [{ cantidad: p.cantidad || 0 }];
    return sum + items.reduce((s: number, i: any) => s + Number(i.cantidad), 0);
  }, 0), [pedidos]);
  
  const totalesPorVendedor = useMemo(() => {
    const totales: Record<string, number> = { Granja: 0, Yulia: 0, Samuel: 0, Merly: 0 };
    pedidos.forEach((p: any) => { 
      if (totales[p.vendedor] !== undefined) {
        const items = p.items || [{ cantidad: p.cantidad || 0 }];
        const cant = items.reduce((s: number, i: any) => s + Number(i.cantidad), 0);
        totales[p.vendedor] += cant; 
      }
    });
    return totales;
  }, [pedidos]);

  const totalesPorTipo = useMemo(() => {
    const totales: Record<string, number> = {};
    TIPOS_HUEVO.forEach(t => totales[t] = 0);
    pedidos.forEach((p: any) => {
      const items = p.items || [{ tipo: p.tipo, cantidad: p.cantidad || 0 }];
      items.forEach((i: any) => {
         if (totales[i.tipo] !== undefined) totales[i.tipo] += Number(i.cantidad);
      });
    });
    return totales;
  }, [pedidos]);

  // Obtener fechas únicas ordenadas
  const fechasOrdenadas = useMemo(() => {
    return Array.from(new Set(pedidos.map(p => p.fechaEntrega))).sort();
  }, [pedidos]);


  // --- PANTALLA DE CARGA Y LOGIN ---
  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-500"></div></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border-t-8 border-yellow-500">
          <div className="flex justify-center mb-6">
            <img src="/logo.jpg" alt="Logo Huevos Queens" className="h-32 object-contain drop-shadow-md" onError={(e: any) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=Falta+Logo' }} />
          </div>
          <h1 className="text-2xl font-black text-center text-slate-800 mb-2">Pedidos Huevos Queens</h1>
          <p className="text-center text-gray-500 text-sm mb-6 font-medium">Sistema de Preventas y Entregas</p>
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
      
      {notificacion && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold animate-bounce flex items-center gap-2">
          <CheckCircle size={20} /> {notificacion}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* CABECERA */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-center border border-gray-200 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <img src="/logo.jpg" alt="Logo Huevos Queens" className="h-16 object-contain drop-shadow-sm" onError={(e: any) => { e.currentTarget.src = 'https://via.placeholder.com/64?text=Logo' }} />
            <div>
              <h1 className="text-2xl font-black text-slate-800">Control de Pedidos</h1>
              <p className="text-sm text-yellow-600 font-bold flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Logística y Preventas</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold w-full md:w-auto justify-center transition-colors">
            <LogOut size={18}/> Salir
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO */}
          <div className="lg:col-span-5 space-y-6">
            <div className={`bg-white rounded-2xl shadow-md border-2 p-6 relative overflow-hidden transition-colors ${editandoId ? 'border-blue-400' : 'border-gray-200'}`}>
              <div className={`absolute top-0 left-0 w-full h-2 ${editandoId ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
              
              <div className="flex justify-between items-center mb-5">
                 <h2 className={`font-black text-xl flex items-center gap-2 ${editandoId ? 'text-blue-600' : 'text-slate-800'}`}>
                   {editandoId ? <Edit className="text-blue-500"/> : <PlusCircle className="text-yellow-500"/>} 
                   {editandoId ? 'Editando Pedido' : 'Registrar Pedido'}
                 </h2>
                 {editandoId && (
                    <button onClick={cancelarEdicion} className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 flex items-center gap-1"><X size={14}/> Cancelar</button>
                 )}
              </div>
              
              <form onSubmit={guardarPedidoFinal} className="space-y-4">
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

                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Para entregar el (Día)</label>
                      <div className="flex gap-2 items-center">
                        <input type="date" required className="flex-1 p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 outline-none transition-all font-bold text-slate-700 cursor-pointer" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                        {fechaEntrega && (
                           <div className={`px-4 py-3 rounded-xl font-black text-sm border-2 ${['Lunes', 'Miércoles', 'Viernes'].includes(obtenerNombreDia(fechaEntrega)) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                             {obtenerNombreDia(fechaEntrega)}
                           </div>
                        )}
                      </div>
                    </div>
                    
                    {/* SECCIÓN: MULTI-REFERENCIAS (CARRITO) */}
                    <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-200">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-1"><ShoppingCart size={14}/> Referencias del Pedido</label>
                       
                       <div className="flex gap-2 items-end mb-3">
                         <div className="flex-1">
                           <label className="text-[10px] font-bold text-yellow-800 uppercase ml-1">Cantidad</label>
                           <input type="number" min="1" className="w-full p-3 border-2 border-yellow-300 rounded-xl bg-white focus:border-yellow-500 outline-none font-black text-center" value={cantidadInput} onChange={e => setCantidadInput(e.target.value)} placeholder="#" />
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] font-bold text-yellow-800 uppercase ml-1">Tipo</label>
                           <select className="w-full p-3 border-2 border-yellow-300 rounded-xl bg-white focus:border-yellow-500 outline-none font-bold" value={tipoHuevoInput} onChange={e => setTipoHuevoInput(e.target.value)}>
                             {TIPOS_HUEVO.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                         </div>
                         <button type="button" onClick={agregarItemAlCarrito} className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 p-3 h-[52px] w-[52px] rounded-xl font-bold shadow-md transition-transform active:scale-95 flex items-center justify-center">
                           <ListPlus size={24}/>
                         </button>
                       </div>

                       {/* Lista de Referencias Agregadas */}
                       {carritoItems.length > 0 && (
                         <div className="space-y-2 mt-4 bg-white p-3 rounded-lg border border-yellow-200 shadow-inner">
                            {carritoItems.map(item => (
                              <div key={item.id} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                <span className="font-black text-slate-700">{item.cantidad} <span className="font-medium text-slate-500">cartones de</span> <span className="text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded uppercase text-xs">{item.tipo}</span></span>
                                <button type="button" onClick={() => removerItemDelCarrito(item.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg"><MinusCircle size={16}/></button>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>

                    {/* SECCIÓN OPCIONAL */}
                    <div className="border border-dashed border-gray-300 p-4 rounded-xl bg-gray-50/50">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-1"><MapPin size={14}/> Datos de Entrega (Opcional)</label>
                       <div className="space-y-3">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="📱 Teléfono" />
                            <input type="text" className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="📍 Dirección" />
                         </div>
                         <textarea className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-yellow-400" value={notasExtra} onChange={e => setNotasExtra(e.target.value)} placeholder="📝 Notas extra (ej: Dejar en portería)..." rows={2} />
                       </div>
                    </div>
                    
                    <div className="pt-2 flex gap-3">
                      <button type="submit" className={`flex-1 text-white font-black py-4 rounded-xl shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 text-lg ${editandoId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
                         {editandoId ? <Edit size={20}/> : <ShoppingCart size={20}/>} 
                         {editandoId ? 'Actualizar Pedido' : 'Guardar Pedido'}
                      </button>
                      
                      {/* BOTÓN MÁGICO DE WHATSAPP */}
                      {(cliente && (carritoItems.length > 0 || cantidadInput) && fechaEntrega) && (
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
              <div className="flex items-baseline gap-2 mb-4 relative z-10">
                 <span className="text-5xl font-black text-white drop-shadow-lg">{totalCartones}</span>
                 <span className="text-xl text-slate-400 font-medium">Cartones Pedidos</span>
              </div>
              
              {/* DESGLOSE POR TIPO DE HUEVO */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6 relative z-10 border-b border-slate-700 pb-4">
                 {TIPOS_HUEVO.map(tipo => {
                    if (totalesPorTipo[tipo] > 0) {
                      return (
                         <div key={tipo} className="bg-slate-700/80 p-2 rounded-lg text-center border border-slate-600 shadow-sm">
                           <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">{tipo}</p>
                           <p className="text-lg font-black text-yellow-400">{totalesPorTipo[tipo]}</p>
                         </div>
                      );
                    }
                    return null;
                 })}
              </div>

              {/* DESGLOSE POR VENDEDOR */}
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

          {/* COLUMNA DERECHA: LISTA DE PEDIDOS AGRUPADOS POR FECHA */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-md border border-gray-200 p-6 flex flex-col min-h-[600px]">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-100 pb-4">
               <h2 className="font-black text-slate-800 text-xl flex items-center gap-2"><Calendar className="text-blue-500"/> Historial de Entregas</h2>
               <div className="relative w-full sm:w-64">
                 <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                 <input type="text" placeholder="Buscar cliente..." className="w-full pl-10 p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-medium transition-all" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
               </div>
             </div>

             <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                
                {fechasOrdenadas.map(fecha => {
                   // Filtrar pedidos de esa fecha
                   const pedidosDelDia = pedidos.filter(p => p.fechaEntrega === fecha && p.cliente.toLowerCase().includes(busqueda.toLowerCase()));
                   if (pedidosDelDia.length === 0) return null;

                   const isExpanded = fechasExpandidas.includes(fecha as string);
                   
                   // Calcular total de cartones solo para este día
                   const totalCartonesDia = pedidosDelDia.reduce((sum, p) => {
                     const items = p.items || [{ cantidad: p.cantidad || 0 }];
                     return sum + items.reduce((s:number, i:any) => s + Number(i.cantidad), 0);
                   }, 0);

                   return (
                      <div key={fecha as string} className="mb-6 animate-in fade-in">
                         {/* ENCABEZADO DEL ACORDEÓN */}
                         <div 
                            onClick={() => toggleFecha(fecha as string)}
                            className="bg-slate-800 text-white p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors shadow-md border-l-4 border-yellow-400"
                         >
                            <div className="flex items-center gap-3">
                               <Calendar size={20} className="text-yellow-400" />
                               <h3 className="font-black text-lg">{obtenerNombreDia(fecha as string)}, <span className="text-slate-300 font-bold">{fecha as string}</span></h3>
                               <span className="hidden sm:inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold">{pedidosDelDia.length} Pedidos</span>
                            </div>
                            <div className="flex items-center gap-4">
                               <span className="font-black text-yellow-400 text-lg">{totalCartonesDia} <span className="text-xs font-medium text-slate-300">Cartones</span></span>
                               {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </div>
                         </div>

                         {/* LISTA DE PEDIDOS DENTRO DEL ACORDEÓN */}
                         {isExpanded && (
                            <div className="mt-4 space-y-4 pl-2 sm:pl-4 border-l-2 border-slate-100 ml-2">
                              {pedidosDelDia.map(pedido => {
                                const perfil = USUARIOS.find(u => u.nombre === pedido.vendedor) || USUARIOS[0];
                                const fechaRegistro = new Date(pedido.timestamp).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                                
                                // Compatibilidad vieja vs nueva (items)
                                const itemsDelPedido = pedido.items || [{ id: 'old', tipo: pedido.tipo, cantidad: pedido.cantidad }];

                                return (
                                  <div key={pedido.id} className={`p-5 rounded-2xl border-l-8 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md bg-white border hover:scale-[1.01] ${pedido.estado === 'entregado' ? 'border-l-green-500 opacity-80' : perfil.color.split(' ')[2]}`}>
                                    
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 w-full">
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full text-white shadow-sm ${perfil.badge}`}>{pedido.vendedor}</span>
                                            <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Calendar size={12}/> Registrado: {fechaRegistro}</span>
                                          </div>
                                          <h3 className={`font-black text-xl mb-1 ${pedido.estado === 'entregado' ? 'text-gray-500 line-through' : 'text-slate-800'}`}>{pedido.cliente}</h3>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100 mt-2 sm:mt-0">
                                          {/* BOTÓN ENTREGADO */}
                                          <button 
                                            onClick={() => cambiarEstadoPedido(pedido.id, pedido.estado)}
                                            className={`px-3 py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-sm border h-[72px] ${
                                              pedido.estado === 'entregado' 
                                                ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' 
                                                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                            }`}
                                          >
                                            {pedido.estado === 'entregado' ? <><CheckCircle size={18}/> <span className="text-[10px] uppercase">Entregado</span></> : <><Clock size={18}/> <span className="text-[10px] uppercase">Pendiente</span></>}
                                          </button>

                                          {/* MULTI-REFERENCIAS VISUAL */}
                                          <div className={`text-center px-4 py-2 rounded-xl border-none shadow-sm h-[72px] flex flex-col justify-center overflow-auto custom-scrollbar min-w-[80px] ${pedido.estado === 'entregado' ? 'bg-gray-100 text-gray-500' : perfil.color}`}>
                                             {itemsDelPedido.map((item: any) => (
                                                <div key={item.id} className="border-b border-current/10 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0 flex justify-between gap-3 items-center">
                                                  <span className="text-xl font-black leading-none">{item.cantidad}</span>
                                                  <span className="text-[10px] font-black uppercase tracking-wider opacity-80 mt-0.5">{item.tipo}</span>
                                                </div>
                                             ))}
                                          </div>

                                          {/* BOTONES DE ACCIÓN (EDITAR/BORRAR) */}
                                          <div className="flex flex-col gap-2">
                                            <button onClick={() => cargarParaEditar(pedido)} className="p-2 bg-blue-50 rounded-xl hover:bg-blue-500 hover:text-white transition-colors text-blue-400 border border-blue-200 shadow-sm" title="Editar pedido"><Edit size={16}/></button>
                                            <button onClick={() => borrarPedido(pedido.id)} className="p-2 bg-gray-50 rounded-xl hover:bg-red-500 hover:text-white transition-colors text-gray-400 border border-gray-200 shadow-sm" title="Eliminar pedido"><Trash2 size={16}/></button>
                                          </div>
                                      </div>
                                    </div>

                                    {/* DATOS EXTRA */}
                                    {(pedido.telefono || pedido.direccion || pedido.notasExtra) && (
                                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600 mt-2">
                                          {pedido.telefono && <p className="flex items-center gap-2"><Phone size={14} className="text-blue-500"/> {pedido.telefono}</p>}
                                          {pedido.direccion && <p className="flex items-center gap-2"><MapPin size={14} className="text-red-500"/> {pedido.direccion}</p>}
                                          {pedido.notasExtra && <p className="md:col-span-2 flex items-start gap-2 mt-1"><FileText size={14} className="text-yellow-600 mt-0.5"/> <span className="italic font-medium">{pedido.notasExtra}</span></p>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                         )}
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}