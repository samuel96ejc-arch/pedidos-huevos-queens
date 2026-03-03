import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PlusCircle, Trash2, Calendar, 
  Search, LogOut, Bell, User, ShoppingCart, CheckCircle,
  MapPin, Phone, FileText, Clock, ChevronDown, ChevronUp, Edit, ListPlus, MinusCircle, X,
  PackageCheck
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
  const [notificacionesHistorial, setNotificacionesHistorial] = useState<any[]>([]);
  
  // Estados para Popups de Notificaciones Separadas
  const [mostrarNuevos, setMostrarNuevos] = useState(false);
  const [mostrarEntregas, setMostrarEntregas] = useState(false);
  const [ultimaVistaNuevos, setUltimaVistaNuevos] = useState(localStorage.getItem('ultimaVistaNuevos') || '0');
  const [ultimaVistaEntregas, setUltimaVistaEntregas] = useState(localStorage.getItem('ultimaVistaEntregas') || '0');
  
  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Formulario Pedido
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vendedorActivo, setVendedorActivo] = useState('');
  const [cliente, setCliente] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  
  // Carrito Multi-Referencia
  const [carritoItems, setCarritoItems] = useState<any[]>([]);
  const [cantidadInput, setCantidadInput] = useState('');
  const [tipoHuevoInput, setTipoHuevoInput] = useState('A');

  // Opcionales
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notasExtra, setNotasExtra] = useState('');

  // Búsqueda y popups (toast)
  const [busqueda, setBusqueda] = useState('');
  const [notificacion, setNotificacion] = useState('');
  const [fechasExpandidas, setFechasExpandidas] = useState<string[]>([]);
  
  // Ref para cerrar panel de notificaciones al cliquear fuera
  const notificacionesRef = useRef<HTMLDivElement>(null);

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

  // --- CERRAR NOTIFICACIONES CLICK OUTSIDE ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificacionesRef.current && !notificacionesRef.current.contains(event.target as Node)) {
        setMostrarNuevos(false);
        setMostrarEntregas(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 2. SINCRONIZACIÓN FIREBASE (Pedidos y Notificaciones) ---
  useEffect(() => {
    if (!user) return;
    
    // Escuchar Pedidos
    const q = query(collection(db, 'pedidos_preventa'), orderBy('timestamp', 'desc'));
    const unsubscribePedidos = onSnapshot(q, (snapshot) => {
      const pedidosArray: any[] = [];
      snapshot.forEach((doc) => {
        pedidosArray.push({ id: doc.id, ...doc.data() });
      });
      setPedidos(pedidosArray);
    }, (error) => {
      console.error("Error BD:", error);
    });

    // Escuchar Notificaciones
    const qNotif = query(collection(db, 'notificaciones_preventa'), orderBy('timestamp', 'desc'));
    const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
      const notifArray: any[] = [];
      snapshot.forEach((doc) => {
        notifArray.push({ id: doc.id, ...doc.data() });
      });
      setNotificacionesHistorial(notifArray.slice(0, 30)); // Aumentado a 30 para tener buen historial en ambas listas
    });

    return () => {
       unsubscribePedidos();
       unsubscribeNotif();
    };
  }, [user]);

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

  const formatearFechaHora = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('es-CO', { day:'numeric', month:'short' })} ${d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}`;
  };

  // --- LÓGICA DE NOTIFICACIONES SEPARADAS ---
  const notifNuevos = notificacionesHistorial.filter(n => n.tipo !== 'entregado');
  const notifEntregas = notificacionesHistorial.filter(n => n.tipo === 'entregado');

  const unreadNuevosCount = notifNuevos.filter(n => n.timestamp > ultimaVistaNuevos).length;
  const unreadEntregasCount = notifEntregas.filter(n => n.timestamp > ultimaVistaEntregas).length;

  const abrirNuevos = () => {
    setMostrarNuevos(!mostrarNuevos);
    setMostrarEntregas(false);
    if (!mostrarNuevos) {
      const now = new Date().toISOString();
      setUltimaVistaNuevos(now);
      localStorage.setItem('ultimaVistaNuevos', now);
    }
  };

  const abrirEntregas = () => {
    setMostrarEntregas(!mostrarEntregas);
    setMostrarNuevos(false);
    if (!mostrarEntregas) {
      const now = new Date().toISOString();
      setUltimaVistaEntregas(now);
      localStorage.setItem('ultimaVistaEntregas', now);
    }
  };

  // --- CREAR NOTIFICACIÓN EN LA BASE DE DATOS ---
  const registrarNotificacion = async (mensaje: string, tipo: 'nuevo' | 'entregado' | 'editado' | 'borrado') => {
      try {
        await addDoc(collection(db, 'notificaciones_preventa'), {
           mensaje,
           tipo,
           timestamp: new Date().toISOString()
        });
      } catch (e) {
         console.error("No se pudo guardar notificación:", e);
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

    let itemsFinales = [...carritoItems];
    if (itemsFinales.length === 0) {
      if (cantidadInput) {
        itemsFinales.push({ id: Date.now().toString(), tipo: tipoHuevoInput, cantidad: Number(cantidadInput) });
        setCantidadInput('');
      } else {
        alert("⚠️ Agrega al menos una referencia de huevo al pedido.");
        return;
      }
    }

    const cantTotal = itemsFinales.reduce((s:number, i:any) => s + Number(i.cantidad), 0);

    const data: any = {
      vendedor: vendedorActivo,
      cliente: cliente,
      fechaEntrega: fechaEntrega,
      direccion: direccion, 
      telefono: telefono,   
      notasExtra: notasExtra,
      items: itemsFinales, 
      estado: editandoId ? (pedidos.find(p => p.id === editandoId)?.estado || 'pendiente') : 'pendiente',
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'pedidos_preventa', editandoId), data);
        setNotificacion('✅ Pedido Actualizado');
        registrarNotificacion(`✏️ ${vendedorActivo} actualizó el pedido de ${cliente}.`, 'editado');
      } else {
        data.timestamp = new Date().toISOString();
        await addDoc(collection(db, 'pedidos_preventa'), data);
        setNotificacion('✅ Pedido Registrado');
        registrarNotificacion(`🛒 ${vendedorActivo} registró ${cantTotal} cartones para ${cliente}.`, 'nuevo');
        
        // Al registrar un pedido nuevo, sí queremos abrir ese día para que el usuario vea su pedido recién creado
        if (!fechasExpandidas.includes(fechaEntrega)) {
           setFechasExpandidas([...fechasExpandidas, fechaEntrega]);
        }
      }
      setTimeout(() => setNotificacion(''), 3000);
      
      setEditandoId(null); setCliente(''); setCarritoItems([]);
      setCantidadInput(''); setDireccion(''); setTelefono(''); setNotasExtra('');
    } catch (error) {
      console.error("Error guardando:", error);
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
    
    const itemsDelPedido = pedido.items || [{ id: Date.now().toString(), tipo: pedido.tipo, cantidad: pedido.cantidad }];
    setCarritoItems(itemsDelPedido);
    setCantidadInput('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditandoId(null); setCliente(''); setCarritoItems([]); setCantidadInput(''); setDireccion(''); setTelefono(''); setNotasExtra('');
  };

  // --- 4. BORRAR PEDIDO ---
  const borrarPedido = async (pedido: any) => {
    if(confirm("¿Estás seguro de eliminar este pedido completamente?")) {
      try {
        await deleteDoc(doc(db, 'pedidos_preventa', pedido.id));
        registrarNotificacion(`🗑️ Se eliminó un pedido de ${pedido.cliente}.`, 'borrado');
        if (editandoId === pedido.id) cancelarEdicion();
      } catch (error) {
        console.error("Error al borrar:", error);
      }
    }
  };

  // --- CAMBIAR ESTADO A ENTREGADO ---
  const cambiarEstadoPedido = async (pedido: any) => {
    const nuevoEstado = pedido.estado === 'entregado' ? 'pendiente' : 'entregado';
    const mensajeConfirmacion = pedido.estado === 'entregado' 
      ? `¿Seguro que quieres regresar el pedido de ${pedido.cliente} a PENDIENTE?` 
      : `¿Confirmas que el pedido de ${pedido.cliente} ya fue ENTREGADO?`;

    if(confirm(mensajeConfirmacion)) {
      try {
        await updateDoc(doc(db, 'pedidos_preventa', pedido.id), { estado: nuevoEstado });
        if (nuevoEstado === 'entregado') {
           registrarNotificacion(`✅ El pedido de ${pedido.cliente} fue marcado como ENTREGADO.`, 'entregado');
        }
      } catch (error) {
        console.error("Error al actualizar estado:", error);
      }
    }
  };

  // --- 5. ENVIAR NOTIFICACIÓN WHATSAPP ---
  const notificarWhatsApp = () => {
    let itemsParaMensaje = [...carritoItems];
    if (itemsParaMensaje.length === 0 && cantidadInput) itemsParaMensaje.push({ tipo: tipoHuevoInput, cantidad: cantidadInput });
    
    let mensaje = `🚨 *${editandoId ? 'ACTUALIZACIÓN DE PEDIDO' : 'NUEVO PEDIDO REGISTRADO'}* 🚨%0A`;
    mensaje += `👤 Vendedor: *${vendedorActivo}*%0A🤝 Cliente: *${cliente}*%0A📅 Para entregar el: *${obtenerNombreDia(fechaEntrega)}, ${fechaEntrega}*%0A%0A`;
    mensaje += `📦 *DETALLE DEL PEDIDO:*%0A`;
    itemsParaMensaje.forEach(i => { mensaje += `- ${i.cantidad} cartones de ${i.tipo}%0A`; });
    if (telefono || direccion || notasExtra) mensaje += `%0A`;
    if (telefono) mensaje += `📱 Teléfono: ${telefono}%0A`;
    if (direccion) mensaje += `📍 Dirección: ${direccion}%0A`;
    if (notasExtra) mensaje += `📝 Notas: ${notasExtra}%0A`;
    mensaje += `%0A_Por favor actualizar el inventario disponible._`;
    
    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
  };

  // --- 6. CÁLCULOS ESTADÍSTICOS ---
  
  // Total Histórico Absoluto (Para panel pequeño)
  const totalHistoricoAbsoluto = useMemo(() => pedidos.reduce((sum: number, p: any) => {
    const items = p.items || [{ cantidad: p.cantidad || 0 }];
    return sum + items.reduce((s: number, i: any) => s + Number(i.cantidad), 0);
  }, 0), [pedidos]);

  // Solo consideramos los PENDIENTES para la resta en tiempo real en los paneles visuales principales
  const pedidosPendientes = useMemo(() => pedidos.filter(p => p.estado !== 'entregado'), [pedidos]);

  const totalCartonesPendientes = useMemo(() => pedidosPendientes.reduce((sum: number, p: any) => {
    const items = p.items || [{ cantidad: p.cantidad || 0 }];
    return sum + items.reduce((s: number, i: any) => s + Number(i.cantidad), 0);
  }, 0), [pedidosPendientes]);

  const pendientesPorTipo = useMemo(() => {
    const totales: Record<string, number> = {};
    TIPOS_HUEVO.forEach(t => totales[t] = 0);
    pedidosPendientes.forEach((p: any) => {
      const items = p.items || [{ tipo: p.tipo, cantidad: p.cantidad || 0 }];
      items.forEach((i: any) => {
         if (totales[i.tipo] !== undefined) totales[i.tipo] += Number(i.cantidad);
      });
    });
    return totales;
  }, [pedidosPendientes]);

  const fechasOrdenadas = useMemo(() => Array.from(new Set(pedidos.map(p => p.fechaEntrega))).sort(), [pedidos]);

  // RESUMEN GENERAL POR FECHA (Para la nueva tabla)
  const resumenPorFechas = useMemo(() => {
     const resumen: any[] = [];
     fechasOrdenadas.forEach(fecha => {
        const pdia = pedidosPendientes.filter(p => p.fechaEntrega === fecha);
        if (pdia.length > 0) {
           const cant = pdia.reduce((sum, p) => {
              const it = p.items || [{ cantidad: p.cantidad || 0 }];
              return sum + it.reduce((s:number, i:any) => s + Number(i.cantidad), 0);
           }, 0);
           resumen.push({ fecha, dia: obtenerNombreDia(fecha as string), cant });
        }
     });
     return resumen;
  }, [fechasOrdenadas, pedidosPendientes]);


  // --- LOGIN UI ---
  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-[#f4f6f5]"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#0f5132]"></div></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a3a23] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border-t-8 border-[#d4af37]">
          <div className="flex justify-center mb-6"><img src="/logo.jpg" alt="Logo Huevos Queens" className="h-32 object-contain drop-shadow-md" onError={(e: any) => { e.currentTarget.src = 'https://via.placeholder.com/150?text=Logo' }} /></div>
          <h1 className="text-2xl font-black text-center text-[#0f5132] mb-2">Pedidos Huevos Queens</h1>
          <p className="text-center text-gray-500 text-sm mb-6 font-bold">Sistema de Preventas Logística</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Correo Electrónico</label>
              <input type="email" placeholder="usuario@correo.com" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] outline-none transition-colors" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Contraseña</label>
              <input type="password" placeholder="••••••••" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] outline-none transition-colors" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold text-center bg-red-50 p-2 rounded-lg">{loginError}</p>}
            <button type="submit" className="w-full bg-[#0f5132] text-white font-black py-4 rounded-xl hover:bg-[#0a3a23] shadow-lg mt-4 text-lg transition-transform active:scale-95">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  // --- APLICACIÓN PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#f4f6f5] p-2 md:p-6 font-sans">
      
      {notificacion && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#0f5132] text-white px-6 py-3 rounded-full shadow-2xl font-bold animate-bounce flex items-center gap-2 border border-[#d4af37]">
          <CheckCircle size={20} className="text-[#d4af37]" /> {notificacion}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* CABECERA Y NOTIFICACIONES PUSH SEPARADAS */}
        <div className="bg-white rounded-3xl shadow-sm p-4 flex justify-between items-center border border-gray-200 relative z-30">
          <div className="flex items-center gap-3 md:gap-4">
            <img src="/logo.jpg" alt="Logo Huevos Queens" className="h-12 md:h-16 object-contain drop-shadow-sm rounded-full bg-white p-1" onError={(e: any) => { e.currentTarget.src = 'https://via.placeholder.com/64?text=Logo' }} />
            <div>
              <h1 className="text-lg md:text-2xl font-black text-[#0f5132] leading-tight">Control Pedidos</h1>
              <p className="text-xs md:text-sm text-[#d4af37] font-bold flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Logística Activa</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4" ref={notificacionesRef}>
             
             {/* BOTÓN 1: ENTREGAS REALIZADAS */}
             <div className="relative">
                <button 
                  onClick={abrirEntregas}
                  className={`p-3 rounded-full relative shadow-sm transition-transform active:scale-95 ${mostrarEntregas ? 'bg-[#c3e6cb] text-[#0f5132]' : 'bg-[#e6f4ea] text-[#0f5132] border border-[#c3e6cb] hover:bg-[#c3e6cb]'}`}
                  title="Ver Entregas Recientes"
                >
                   <PackageCheck size={20}/>
                   {unreadEntregasCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-green-600 text-white text-[10px] font-bold items-center justify-center border-2 border-white shadow-sm">{unreadEntregasCount}</span>
                      </span>
                   )}
                </button>
                
                {/* POPUP ENTREGAS */}
                {mostrarEntregas && (
                   <div className="absolute top-14 right-0 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                      <div className="bg-[#e6f4ea] text-[#0f5132] p-4 font-black flex justify-between items-center border-b border-[#c3e6cb]">
                        <span className="flex items-center gap-2"><PackageCheck size={18}/> Entregas Recientes</span>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full shadow-sm">{notifEntregas.length}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50">
                         {notifEntregas.length === 0 ? (
                           <p className="text-center text-gray-400 text-sm py-8 font-medium">No hay entregas recientes.</p>
                         ) : (
                           notifEntregas.map(n => (
                             <div key={n.id} className="bg-white p-3 rounded-xl border border-green-100 shadow-sm text-sm border-l-4 border-l-green-500">
                               <p className="text-slate-700 font-medium leading-tight">{n.mensaje}</p>
                               <span className="text-[10px] text-gray-400 font-bold mt-2 block">{formatearFechaHora(n.timestamp)}</span>
                             </div>
                           ))
                         )}
                      </div>
                   </div>
                )}
             </div>

             {/* BOTÓN 2: PEDIDOS NUEVOS/EDITADOS */}
             <div className="relative">
                <button 
                  onClick={abrirNuevos}
                  className={`p-3 rounded-full relative shadow-sm transition-transform active:scale-95 ${mostrarNuevos ? 'bg-[#f3e7c8] text-[#0f5132]' : 'bg-[#fdfaf2] text-[#d4af37] border border-[#f3e7c8] hover:bg-[#f3e7c8]'}`}
                  title="Ver Pedidos Nuevos"
                >
                   <Bell size={20}/>
                   {unreadNuevosCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-[10px] font-bold items-center justify-center border-2 border-white shadow-sm">{unreadNuevosCount}</span>
                      </span>
                   )}
                </button>
                
                {/* POPUP NUEVOS PEDIDOS */}
                {mostrarNuevos && (
                   <div className="absolute top-14 right-0 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                      <div className="bg-[#0f5132] text-white p-4 font-black flex justify-between items-center">
                        <span className="flex items-center gap-2"><Bell size={16} className="text-[#d4af37]"/> Pedidos & Novedades</span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{notifNuevos.length}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50">
                         {notifNuevos.length === 0 ? (
                           <p className="text-center text-gray-400 text-sm py-8 font-medium">No hay pedidos recientes.</p>
                         ) : (
                           notifNuevos.map(n => (
                             <div key={n.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-sm border-l-4 border-l-[#d4af37]">
                               <p className="text-slate-700 font-medium leading-tight">{n.mensaje}</p>
                               <span className="text-[10px] text-gray-400 font-bold mt-2 block">{formatearFechaHora(n.timestamp)}</span>
                             </div>
                           ))
                         )}
                      </div>
                   </div>
                )}
             </div>

             <button onClick={() => signOut(auth)} className="hidden md:flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 font-bold transition-colors ml-2">
               <LogOut size={16}/> Salir
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO Y RESUMEN GENERAL */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
            
            {/* NUEVO PANEL: RESUMEN GENERAL POR FECHA (SOLO PENDIENTES) */}
            <div className="bg-gradient-to-br from-[#0f5132] to-[#0a3a23] rounded-3xl p-6 text-white shadow-xl border border-[#166e44] relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
               
               <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-3 relative z-10">
                 <h3 className="font-black text-lg flex items-center gap-2 text-white"><Calendar size={20} className="text-[#d4af37]"/> Resumen General <span className="text-[10px] bg-[#d4af37] text-[#0f5132] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ml-1">Pendientes</span></h3>
                 <span className="text-4xl font-black text-white drop-shadow-md">{totalCartonesPendientes}</span>
               </div>
               
               {resumenPorFechas.length === 0 ? (
                  <div className="bg-white/10 p-4 rounded-2xl text-center text-[#d4af37] text-sm font-bold border border-white/10 backdrop-blur-sm">
                    🎉 ¡No hay pedidos pendientes para entregar!
                  </div>
               ) : (
                 <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                   {resumenPorFechas.map(r => (
                      <div key={r.fecha} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl shadow-sm hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/5">
                         <div>
                            <span className="block text-xs font-black uppercase text-[#d4af37]">{r.dia}</span>
                            <span className="block font-bold text-white text-sm">{r.fecha}</span>
                         </div>
                         <div className="bg-white text-[#0f5132] px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-inner">
                            <span className="font-black text-lg leading-none">{r.cant}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-500">Ctns</span>
                         </div>
                      </div>
                   ))}
                 </div>
               )}
            </div>

            {/* PANEL FORMULARIO REGISTRO */}
            <div className={`bg-white rounded-3xl shadow-sm border p-6 relative overflow-hidden transition-colors ${editandoId ? 'border-blue-400' : 'border-gray-200'}`}>
              <div className={`absolute top-0 left-0 w-full h-2 ${editandoId ? 'bg-blue-500' : 'bg-[#d4af37]'}`}></div>
              
              <div className="flex justify-between items-center mb-5 mt-1">
                 <h2 className={`font-black text-xl flex items-center gap-2 ${editandoId ? 'text-blue-600' : 'text-[#0f5132]'}`}>
                   {editandoId ? <Edit className="text-blue-500"/> : <PlusCircle className="text-[#d4af37]"/>} 
                   {editandoId ? 'Editando Pedido' : 'Registrar Pedido'}
                 </h2>
                 {editandoId && (
                    <button onClick={cancelarEdicion} className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 flex items-center gap-1"><X size={14}/> Cancelar</button>
                 )}
              </div>
              
              <form onSubmit={guardarPedidoFinal} className="space-y-5">
                <div className="bg-[#fdfaf2] p-4 rounded-2xl border border-[#f3e7c8]">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 block">1. ¿Quién registra el pedido?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {USUARIOS.map(u => (
                      <button 
                        key={u.nombre} type="button" 
                        onClick={() => setVendedorActivo(u.nombre)}
                        className={`p-3 rounded-xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 ${vendedorActivo === u.nombre ? 'bg-[#0f5132] text-white border-[#0f5132] shadow-md scale-[1.02]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}
                      >
                        <User size={16} className={vendedorActivo === u.nombre ? "text-[#d4af37]" : "text-gray-400"}/> {u.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {vendedorActivo && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">Nombre del Cliente / Negocio</label>
                      <input type="text" required className="w-full p-3.5 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#0f5132] focus:ring-4 focus:ring-[#0f5132]/10 outline-none transition-all font-medium text-slate-700" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ej: Tienda Don Pepe" />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">Para entregar el (Día)</label>
                      <div className="flex gap-2 items-center">
                        <input type="date" required className="flex-1 p-3.5 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#0f5132] focus:ring-4 focus:ring-[#0f5132]/10 outline-none transition-all font-bold text-slate-700 cursor-pointer" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
                        {fechaEntrega && (
                           <div className={`px-4 py-3.5 rounded-xl font-black text-sm border-2 ${['Lunes', 'Miércoles', 'Viernes'].includes(obtenerNombreDia(fechaEntrega)) ? 'bg-[#e6f4ea] text-[#0f5132] border-[#c3e6cb]' : 'bg-[#fdfaf2] text-[#d4af37] border-[#f3e7c8]'}`}>
                             {obtenerNombreDia(fechaEntrega)}
                           </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 block flex items-center gap-1.5"><ShoppingCart size={14} className="text-[#d4af37]"/> Referencias del Pedido</label>
                       <div className="flex gap-2 items-end mb-3">
                         <div className="flex-1">
                           <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">Cantidad</label>
                           <input type="number" min="1" className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white focus:border-[#0f5132] outline-none font-black text-center" value={cantidadInput} onChange={e => setCantidadInput(e.target.value)} placeholder="#" />
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">Tipo</label>
                           <select className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white focus:border-[#0f5132] outline-none font-bold text-slate-700" value={tipoHuevoInput} onChange={e => setTipoHuevoInput(e.target.value)}>
                             {TIPOS_HUEVO.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                         </div>
                         <button type="button" onClick={agregarItemAlCarrito} className="bg-[#d4af37] hover:bg-[#c4a132] text-white p-3 h-[52px] w-[52px] rounded-xl font-bold shadow-md transition-transform active:scale-95 flex items-center justify-center">
                           <ListPlus size={24}/>
                         </button>
                       </div>
                       {carritoItems.length > 0 && (
                         <div className="space-y-2 mt-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            {carritoItems.map(item => (
                              <div key={item.id} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                <span className="font-black text-slate-700">{item.cantidad} <span className="font-medium text-slate-400">ctns de</span> <span className="text-[#0f5132] bg-[#e6f4ea] px-2 py-0.5 rounded uppercase text-xs">{item.tipo}</span></span>
                                <button type="button" onClick={() => removerItemDelCarrito(item.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg"><MinusCircle size={16}/></button>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>

                    <div className="border border-dashed border-gray-300 p-4 rounded-2xl bg-white">
                       <label className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 block flex items-center gap-1.5"><MapPin size={14} className="text-gray-400"/> Entrega (Opcional)</label>
                       <div className="space-y-3">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#0f5132] bg-gray-50 focus:bg-white transition-colors" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="📱 Teléfono" />
                            <input type="text" className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#0f5132] bg-gray-50 focus:bg-white transition-colors" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="📍 Dirección" />
                         </div>
                         <textarea className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#0f5132] bg-gray-50 focus:bg-white transition-colors" value={notasExtra} onChange={e => setNotasExtra(e.target.value)} placeholder="📝 Notas extra..." rows={2} />
                       </div>
                    </div>
                    
                    <div className="pt-2 flex gap-3">
                      <button type="submit" className={`flex-1 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-lg ${editandoId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#0f5132] hover:bg-[#0a3a23]'}`}>
                         {editandoId ? <Edit size={20}/> : <ShoppingCart size={20} className="text-[#d4af37]"/>} 
                         {editandoId ? 'Actualizar Pedido' : 'Guardar Pedido'}
                      </button>
                      {(cliente && (carritoItems.length > 0 || cantidadInput) && fechaEntrega) && (
                        <button type="button" onClick={notificarWhatsApp} className="bg-[#25D366] text-white p-4 rounded-xl hover:bg-[#1ebd5a] shadow-lg transition-transform active:scale-95 flex items-center justify-center" title="Avisar a WhatsApp">
                          <Bell size={24}/>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* DETALLES DE HUEVOS (RESTA EN TIEMPO REAL - PENDIENTES) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-sm text-[#0f5132] font-black uppercase tracking-wider mb-4 border-b border-gray-100 pb-3 flex items-center gap-2"><PackageCheck size={18} className="text-[#d4af37]"/> Referencias Pendientes</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                 {TIPOS_HUEVO.map(tipo => {
                    if (pendientesPorTipo[tipo] > 0) {
                      return (
                         <div key={tipo} className="bg-[#fdfaf2] p-3 rounded-2xl text-center border border-[#f3e7c8] shadow-sm">
                           <p className="text-[11px] text-gray-500 font-black uppercase tracking-wider mb-1">{tipo}</p>
                           <p className="text-xl font-black text-[#0f5132]">{pendientesPorTipo[tipo]}</p>
                         </div>
                      );
                    }
                    return null;
                 })}
                 {Object.values(pendientesPorTipo).every(v => v === 0) && <p className="col-span-4 text-center text-gray-400 text-sm py-4 font-bold">Sin referencias pendientes.</p>}
              </div>
            </div>

            {/* ESTADÍSTICAS GLOBALES DEL MES (OCULTABLE) */}
             <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                 <h4 className="text-xs font-black text-gray-500 uppercase">Volumen Histórico Total</h4>
                 <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                    <span className="font-black text-[#0f5132] text-xl">{totalHistoricoAbsoluto}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">ctns</span>
                 </div>
             </div>
          </div>

          {/* COLUMNA DERECHA: LISTA DE PEDIDOS AGRUPADOS POR FECHA (DOBLE LISTA) */}
          <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-gray-200 p-4 md:p-6 flex flex-col min-h-[600px]">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-100 pb-5">
               <h2 className="font-black text-[#0f5132] text-xl flex items-center gap-2"><Calendar className="text-[#d4af37]"/> Entregas Logística</h2>
               <div className="relative w-full sm:w-64">
                 <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                 <input type="text" placeholder="Buscar cliente..." className="w-full pl-10 p-3.5 border-2 border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:border-[#0f5132] focus:ring-4 focus:ring-[#0f5132]/10 outline-none text-sm font-medium transition-all" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
               </div>
             </div>

             <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                
                {fechasOrdenadas.map(fecha => {
                   // Filtrar pedidos generales del día buscado
                   const pedidosDelDia = pedidos.filter(p => p.fechaEntrega === fecha && p.cliente.toLowerCase().includes(busqueda.toLowerCase()));
                   if (pedidosDelDia.length === 0) return null;

                   const isExpanded = fechasExpandidas.includes(fecha as string);
                   
                   // Separar en las dos listas solicitadas
                   const pedidosPendientesDelDia = pedidosDelDia.filter(p => p.estado !== 'entregado');
                   const pedidosEntregadosDelDia = pedidosDelDia.filter(p => p.estado === 'entregado');
                   
                   const totalPendientesCartones = pedidosPendientesDelDia.reduce((sum, p) => sum + (p.items || [{ cantidad: p.cantidad || 0 }]).reduce((s:number, i:any) => s + Number(i.cantidad), 0), 0);

                   return (
                      <div key={fecha as string} className="mb-4">
                         {/* ENCABEZADO DEL ACORDEÓN */}
                         <div 
                            onClick={() => toggleFecha(fecha as string)}
                            className={`p-4 md:p-5 rounded-2xl flex justify-between items-center cursor-pointer transition-all shadow-sm border-2 ${isExpanded ? 'bg-[#0f5132] text-white border-[#0f5132]' : 'bg-white border-gray-100 hover:border-[#d4af37] hover:shadow-md'}`}
                         >
                            <div className="flex items-center gap-3">
                               <Calendar size={22} className={isExpanded ? "text-[#d4af37]" : "text-[#0f5132]"} />
                               <h3 className="font-black text-lg md:text-xl">{obtenerNombreDia(fecha as string)}, <span className={`${isExpanded ? 'text-white/80' : 'text-gray-400'} font-bold`}>{fecha as string}</span></h3>
                            </div>
                            <div className="flex items-center gap-4">
                               {totalPendientesCartones > 0 ? (
                                 <span className={`font-black text-lg px-4 py-1.5 rounded-xl shadow-inner ${isExpanded ? 'bg-white/20 text-[#d4af37]' : 'bg-[#fdfaf2] text-[#c4a132] border border-[#f3e7c8]'}`}>{totalPendientesCartones} Pend.</span>
                               ) : (
                                 <span className="bg-[#e6f4ea] text-[#0f5132] text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 uppercase tracking-wider border border-[#c3e6cb]"><CheckCircle size={14}/> Listo</span>
                               )}
                               <div className={`p-1 rounded-full ${isExpanded ? 'bg-white/10' : 'bg-gray-100'}`}>
                                 {isExpanded ? <ChevronUp size={20} className="text-white"/> : <ChevronDown size={20} className="text-gray-500"/>}
                               </div>
                            </div>
                         </div>

                         {/* CONTENIDO DESGLOSADO: LAS DOS LISTAS */}
                         {isExpanded && (
                            <div className="mt-5 space-y-6 pl-2 sm:pl-5 border-l-2 border-[#d4af37]/30 ml-3 mb-10">
                              
                              {/* LISTA 1: PENDIENTES POR ENTREGAR */}
                              <div className="space-y-4">
                                 <h4 className="font-black text-[#0f5132] text-sm uppercase tracking-wider flex items-center gap-2 bg-[#fdfaf2] border border-[#f3e7c8] inline-block px-4 py-1.5 rounded-r-full shadow-sm"><Clock size={16} className="text-[#d4af37]"/> Pendientes por Entregar ({pedidosPendientesDelDia.length})</h4>
                                 
                                 {pedidosPendientesDelDia.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic pl-4">No hay pendientes para este día.</p>
                                 ) : (
                                    pedidosPendientesDelDia.map(pedido => {
                                      const perfil = USUARIOS.find(u => u.nombre === pedido.vendedor) || USUARIOS[0];
                                      const itemsDelPedido = pedido.items || [{ id: 'old', tipo: pedido.tipo, cantidad: pedido.cantidad }];
      
                                      return (
                                        <div key={pedido.id} className={`p-4 md:p-5 rounded-2xl border-l-8 shadow-sm flex flex-col gap-4 transition-all bg-white border border-gray-100 hover:shadow-md ${perfil.color.split(' ')[2]}`}>
                                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 w-full">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full text-white shadow-sm ${perfil.badge}`}>{pedido.vendedor}</span>
                                                </div>
                                                <h3 className="font-black text-xl mb-1 text-slate-800 leading-tight">{pedido.cliente}</h3>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100 mt-2 sm:mt-0">
                                                <button onClick={() => cambiarEstadoPedido(pedido)} className="px-3 py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-sm border h-[72px] bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:scale-105 active:scale-95">
                                                  <Clock size={18}/> <span className="text-[10px] uppercase">Pendiente</span>
                                                </button>
                                                <div className={`text-center px-4 py-2 rounded-xl border-none shadow-inner h-[72px] flex flex-col justify-center overflow-auto custom-scrollbar min-w-[80px] ${perfil.color}`}>
                                                   {itemsDelPedido.map((item: any) => (
                                                      <div key={item.id} className="border-b border-current/10 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0 flex justify-between gap-3 items-center">
                                                        <span className="text-xl font-black leading-none">{item.cantidad}</span>
                                                        <span className="text-[10px] font-black uppercase tracking-wider opacity-80 mt-0.5">{item.tipo}</span>
                                                      </div>
                                                   ))}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                  <button onClick={() => cargarParaEditar(pedido)} className="p-2 bg-blue-50 rounded-xl hover:bg-blue-500 hover:text-white transition-colors text-blue-500 border border-blue-200 shadow-sm"><Edit size={16}/></button>
                                                  <button onClick={() => borrarPedido(pedido)} className="p-2 bg-gray-50 rounded-xl hover:bg-red-500 hover:text-white transition-colors text-gray-400 border border-gray-200 shadow-sm"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                          </div>
                                          {(pedido.telefono || pedido.direccion || pedido.notasExtra) && (
                                            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-sm grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-600">
                                                {pedido.telefono && <p className="flex items-center gap-2"><Phone size={14} className="text-[#0f5132]"/> <span className="font-medium">{pedido.telefono}</span></p>}
                                                {pedido.direccion && <p className="flex items-center gap-2"><MapPin size={14} className="text-red-500"/> <span className="font-medium">{pedido.direccion}</span></p>}
                                                {pedido.notasExtra && <p className="md:col-span-2 flex items-start gap-2 mt-1 bg-white p-2 rounded-lg border border-gray-100"><FileText size={14} className="text-[#d4af37] mt-0.5 shrink-0"/> <span className="italic font-medium">{pedido.notasExtra}</span></p>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                 )}
                              </div>

                              {/* LISTA 2: ENTREGADOS (COMPLETADOS) */}
                              {pedidosEntregadosDelDia.length > 0 && (
                                <div className="space-y-4 pt-6 border-t-2 border-dashed border-gray-200">
                                   <h4 className="font-black text-[#0f5132] text-sm uppercase tracking-wider flex items-center gap-2 bg-[#e6f4ea] border border-[#c3e6cb] inline-block px-4 py-1.5 rounded-r-full shadow-sm"><CheckCircle size={16} className="text-[#0f5132]"/> Ya Entregados ({pedidosEntregadosDelDia.length})</h4>
                                   
                                   {pedidosEntregadosDelDia.map(pedido => {
                                      const perfil = USUARIOS.find(u => u.nombre === pedido.vendedor) || USUARIOS[0];
                                      const itemsDelPedido = pedido.items || [{ id: 'old', tipo: pedido.tipo, cantidad: pedido.cantidad }];
                                      
                                      return (
                                        <div key={pedido.id} className="p-3 md:p-4 rounded-xl border-l-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 transition-all bg-gray-50 border border-gray-200 border-l-[#0f5132] opacity-80 hover:opacity-100 grayscale hover:grayscale-0">
                                            <div className="flex-1 w-full flex items-center gap-3">
                                               <span className={`text-[9px] font-black uppercase px-2 py-1 rounded text-white shadow-sm ${perfil.badge}`}>{pedido.vendedor}</span>
                                               <h3 className="font-bold text-lg text-gray-500 line-through decoration-gray-400">{pedido.cliente}</h3>
                                            </div>
                                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-200">
                                                <button onClick={() => cambiarEstadoPedido(pedido)} className="px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all shadow-sm border bg-[#e6f4ea] text-[#0f5132] border-[#c3e6cb] hover:bg-[#c3e6cb] text-xs hover:scale-105">
                                                  <CheckCircle size={14}/> ENTREGADO
                                                </button>
                                                <div className="flex gap-1 text-xs text-gray-500 font-bold bg-white px-2 py-1.5 rounded border border-gray-200">
                                                  {itemsDelPedido.map((i:any) => <span key={i.id}>{i.cantidad}{i.tipo}</span>)}
                                                </div>
                                                <button onClick={() => borrarPedido(pedido)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                      );
                                   })}
                                </div>
                              )}

                            </div>
                         )}
                      </div>
                   );
                })}

                {pedidos.length === 0 && (
                  <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                    <div className="bg-gray-50 p-6 rounded-full mb-4 border border-gray-100 shadow-inner"><ShoppingCart size={64} className="text-gray-300"/></div>
                    <p className="font-black text-xl text-gray-400">Aún no hay pedidos registrados</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}} />
    </div>
  );
}
