import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';

// IMPORTANTE: Para que a funcionalidade de download de PDF funcione,
// você precisa incluir as seguintes linhas no <head> do seu arquivo HTML principal:
 <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
 <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

// Crie um contexto para o Firebase e dados do usuário
const FirebaseContext = createContext(null);

// Configuração do Firebase fornecida pelo usuário
const firebaseConfig = {
    apiKey: "AIzaSyCDeWtdKDy_u2TneTGAa2iloJF-TJIvReE",
    authDomain: "oscell.firebaseapp.com",
    projectId: "oscell",
    storageBucket: "oscell.firebasestorage.app",
    messagingSenderId: "708260228799",
    appId: "1:708260228799:web:38fb055779b9151d34a00a" // Este será usado como o 'appId' para as coleções
};

// Componente Provedor Firebase
const FirebaseProvider = ({ children }) => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loadingFirebase, setLoadingFirebase] = useState(true);
    const [errorFirebase, setErrorFirebase] = useState(null);

    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                // Remove as variáveis globais do ambiente anterior e usa a configuração fornecida
                // __app_id, __firebase_config e __initial_auth_token não são necessários para rodar localmente com sua própria config.
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        // Tenta autenticação anônima se não houver token inicial (como em ambientes locais)
                        await signInAnonymously(firebaseAuth);
                    }
                    setLoadingFirebase(false);
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("Erro ao inicializar Firebase:", error);
                setErrorFirebase(error.message);
                setLoadingFirebase(false);
            }
        };

        initializeFirebase();
    }, []); // Array de dependências vazio para rodar apenas uma vez na montagem

    if (loadingFirebase) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                    <p className="mt-4 text-lg text-gray-700">Carregando Firebase...</p>
                </div>
            </div>
        );
    }

    if (errorFirebase) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-700">
                <p>Erro ao carregar o aplicativo: {errorFirebase}. Por favor, tente novamente mais tarde.</p>
            </div>
        );
    }

    return (
        <FirebaseContext.Provider value={{ db, auth, userId }}>
            {children}
        </FirebaseContext.Provider>
    );
};

// Hook personalizado para usar o contexto Firebase
const useFirebase = () => {
    return useContext(FirebaseContext);
};

// Componente de Cabeçalho
const Header = ({ onNavigate, currentPage }) => {
    return (
        <header className="bg-gradient-to-r from-purple-600 to-indigo-700 p-4 shadow-lg rounded-b-xl">
            <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                <h1 className="text-white text-3xl font-bold tracking-tight mb-2 sm:mb-0">Jordan Cell</h1>
                <nav className="space-x-4">
                    <button
                        onClick={() => onNavigate('services')}
                        className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 ${
                            currentPage === 'services'
                                ? 'bg-white text-purple-700 shadow-md'
                                : 'text-white hover:bg-purple-700 hover:shadow-lg'
                        }`}
                    >
                        Registro de Serviços
                    </button>
                    <button
                        onClick={() => onNavigate('os_generator')}
                        className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 ${
                            currentPage === 'os_generator'
                                ? 'bg-white text-purple-700 shadow-md'
                                : 'text-white hover:bg-purple-700 hover:shadow-lg'
                        }`}
                    >
                        Gerador de O.S.
                    </button>
                </nav>
            </div>
        </header>
    );
};

// Componente de Registro de Serviços
const ServiceRegistration = () => {
    const { db, userId } = useFirebase();
    const [services, setServices] = useState([]);
    const [form, setForm] = useState({
        id: null,
        date: '',
        clientName: '',
        deviceName: '',
        serviceType: '',
        partsCost: '',
        chargedAmount: '',
        timeTaken: '',
    });
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' ou 'error'

    // Define a referência da coleção para serviços, específica para o usuário
    // Usa firebaseConfig.appId diretamente
    const servicesCollectionRef = db ? collection(db, `artifacts/${firebaseConfig.appId}/users/${userId}/services`) : null;

    useEffect(() => {
        if (!db || !userId) return; // Garante que db e userId estejam disponíveis

        // Usa onSnapshot para atualizações em tempo real para a lista de serviços
        const q = query(servicesCollectionRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const serviceList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date instanceof Date ? doc.data().date.toISOString().split('T')[0] : doc.data().date // Garante que a data seja string para input
            }));
            // Ordena os serviços por data em ordem decrescente (mais recente primeiro)
            setServices(serviceList.sort((a, b) => new Date(b.date) - new Date(a.date)));
        }, (error) => {
            console.error("Erro ao carregar serviços:", error);
            showMessage("Erro ao carregar serviços.", 'error');
        });

        // Função de limpeza para a inscrição
        return () => unsubscribe();
    }, [db, userId, servicesCollectionRef]); // Array de dependências inclui db, userId e servicesCollectionRef

    // Lida com as mudanças nos inputs do formulário
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({
            ...form,
            [name]: value,
        });
    };

    // Calcula o lucro com base no custo das peças e no valor cobrado
    const calculateProfit = () => {
        const partsCost = parseFloat(form.partsCost) || 0;
        const chargedAmount = parseFloat(form.chargedAmount) || 0;
        return (chargedAmount - partsCost).toFixed(2);
    };

    // Exibe mensagens (sucesso/erro) para o usuário
    const showMessage = (msg, type) => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => {
            setMessage('');
            setMessageType('');
        }, 3000); // A mensagem desaparece após 3 segundos
    };

    // Lida com o envio do formulário (adicionar novo serviço ou atualizar existente)
    const handleSubmit = async (e) => {
        e.preventDefault(); // Previne o comportamento padrão de envio do formulário
        if (!db || !userId) {
            showMessage("Firebase não inicializado. Tente novamente.", 'error');
            return;
        }

        try {
            const serviceData = {
                date: form.date,
                clientName: form.clientName,
                deviceName: form.deviceName,
                serviceType: form.serviceType,
                partsCost: parseFloat(form.partsCost) || 0,
                chargedAmount: parseFloat(form.chargedAmount) || 0,
                profit: parseFloat(calculateProfit()),
                timeTaken: form.timeTaken,
                createdAt: serverTimestamp(), // Adiciona o timestamp do servidor para criação
            };

            if (form.id) {
                // Se form.id existe, atualiza o documento de serviço existente
                const serviceDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users/${userId}/services`, form.id);
                await updateDoc(serviceDocRef, serviceData);
                showMessage("Serviço atualizado com sucesso!", 'success');
            } else {
                // Caso contrário, adiciona um novo documento de serviço
                await addDoc(servicesCollectionRef, serviceData);
                showMessage("Serviço adicionado com sucesso!", 'success');
            }
            // Reseta o formulário após o envio
            setForm({
                id: null,
                date: '',
                clientName: '',
                deviceName: '',
                serviceType: '',
                partsCost: '',
                chargedAmount: '',
                timeTaken: '',
            });
        } catch (error) {
            console.error("Erro ao salvar serviço:", error);
            showMessage("Erro ao salvar serviço. Tente novamente.", 'error');
        }
    };

    // Preenche os campos do formulário para editar um serviço existente
    const handleEdit = (service) => {
        setForm({
            id: service.id,
            date: service.date,
            clientName: service.clientName,
            deviceName: service.deviceName,
            serviceType: service.serviceType,
            partsCost: service.partsCost,
            chargedAmount: service.chargedAmount,
            timeTaken: service.timeTaken,
        });
    };

    // Lida com a exclusão de um serviço
    const handleDelete = async (id) => {
        if (!db || !userId) {
            showMessage("Firebase não inicializado. Tente novamente.", 'error');
            return;
        }

        // Diálogo de confirmação antes de excluir
        if (window.confirm("Tem certeza que deseja deletar este serviço?")) { // Usando window.confirm por simplicidade, mas um modal customizado é preferível em produção
            try {
                const serviceDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users/${userId}/services`, id);
                await deleteDoc(serviceDocRef); // Deleta o documento
                showMessage("Serviço deletado com sucesso!", 'success');
            } catch (error) {
                console.error("Erro ao deletar serviço:", error);
                showMessage("Erro ao deletar serviço. Tente novamente.", 'error');
            }
        }
    };

    // Define a data para hoje
    const setDateToday = () => {
        setForm({ ...form, date: new Date().toISOString().split('T')[0] });
    };

    // Define a data para ontem
    const setDateYesterday = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setForm({ ...form, date: yesterday.toISOString().split('T')[0] });
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl my-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Registro de Serviços</h2>

            {/* Área de exibição de mensagens */}
            {message && (
                <div className={`p-3 rounded-md mb-4 text-center font-semibold ${
                    messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                    {message}
                </div>
            )}

            {/* Formulário de registro de serviços */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-lg shadow-inner">
                <div className="col-span-1">
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">Data</label>
                    <div className="flex items-center space-x-2 mt-1">
                        <input
                            type="date"
                            id="date"
                            name="date"
                            value={form.date}
                            onChange={handleChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            required
                        />
                        <button
                            type="button"
                            onClick={setDateToday}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors duration-200"
                        >
                            Hoje
                        </button>
                        <button
                            type="button"
                            onClick={setDateYesterday}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-400 rounded-md hover:bg-blue-500 transition-colors duration-200"
                        >
                            Ontem
                        </button>
                    </div>
                </div>
                <div className="col-span-1">
                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">Nome do Cliente</label>
                    <input
                        type="text"
                        id="clientName"
                        name="clientName"
                        value={form.clientName}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Ex: João da Silva"
                        required
                    />
                </div>
                <div className="col-span-1">
                    <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700">Nome do Aparelho</label>
                    <input
                        type="text"
                        id="deviceName"
                        name="deviceName"
                        value={form.deviceName}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Ex: iPhone 13 Pro Max"
                        required
                    />
                </div>
                <div className="col-span-1">
                    <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700">Tipo de Serviço</label>
                    <input
                        type="text"
                        id="serviceType"
                        name="serviceType"
                        value={form.serviceType}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Ex: Troca de tela, Reparo de placa"
                        required
                    />
                </div>
                <div className="col-span-1">
                    <label htmlFor="partsCost" className="block text-sm font-medium text-gray-700">Valor Gasto (Peça)</label>
                    <input
                        type="number"
                        id="partsCost"
                        name="partsCost"
                        value={form.partsCost}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                    />
                </div>
                <div className="col-span-1">
                    <label htmlFor="chargedAmount" className="block text-sm font-medium text-gray-700">Valor Cobrado</label>
                    <input
                        type="number"
                        id="chargedAmount"
                        name="chargedAmount"
                        value={form.chargedAmount}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        required
                    />
                </div>
                <div className="col-span-1">
                    <label htmlFor="profit" className="block text-sm font-medium text-gray-700">Lucro</label>
                    <input
                        type="text"
                        id="profit"
                        name="profit"
                        value={calculateProfit()}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 sm:text-sm"
                        readOnly
                    />
                </div>
                <div className="col-span-1">
                    <label htmlFor="timeTaken" className="block text-sm font-medium text-gray-700">Tempo Demorado</label>
                    <input
                        type="text"
                        id="timeTaken"
                        name="timeTaken"
                        value={form.timeTaken}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Ex: 2 horas, 30 min"
                    />
                </div>
                <div className="col-span-2 flex justify-end space-x-4 mt-4">
                    <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
                    >
                        {form.id ? 'Atualizar Serviço' : 'Adicionar Serviço'}
                    </button>
                    {form.id && (
                        <button
                            type="button"
                            onClick={() => setForm({ id: null, date: '', clientName: '', deviceName: '', serviceType: '', partsCost: '', chargedAmount: '', timeTaken: '' })}
                            className="inline-flex justify-center py-2 px-6 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                        >
                            Limpar Formulário
                        </button>
                    )}
                </div>
            </form>

            {/* Tabela para exibir serviços registrados */}
            <div className="mt-10 overflow-x-auto">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">Serviços Registrados</h3>
                {services.length === 0 ? (
                    <p className="text-center text-gray-500">Nenhum serviço registrado ainda.</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden shadow-lg">
                        <thead className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Aparelho</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Serviço</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Custo Peça</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Cobrado</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Lucro</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Tempo</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {services.map((service) => (
                                <tr key={service.id} className="hover:bg-gray-50 transition-colors duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.deviceName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.serviceType}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">R$ {service.partsCost.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">R$ {service.chargedAmount.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">R$ {service.profit.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.timeTaken}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleEdit(service)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors duration-200"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(service.id)}
                                            className="text-red-600 hover:text-red-900 transition-colors duration-200"
                                        >
                                            Deletar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
             {/* Exibe o ID do usuário atual */}
             <p className="text-center text-sm text-gray-500 mt-8">
                ID do Usuário: {userId}
            </p>
        </div>
    );
};

// Componente Gerador de Ordem de Serviço
const OSGenerator = () => {
    const { db, userId } = useFirebase(); // Obtém db e userId do contexto
    const [osForm, setOsForm] = useState({
        osNumber: '', // Agora editável e definido automaticamente
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        clientPhone: '',
        deviceName: '',
        problemReported: '',
        serviceDescription: '',
        serviceValue: '',
        technicianName: 'Jordan Cell', // Nome do técnico padrão
    });

    // Usa firebaseConfig.appId na referência do documento de configurações
    const osSettingsDocRef = db ? doc(db, `artifacts/${firebaseConfig.appId}/public/data/os_settings/settings`) : null;

    // Efeito para carregar o último número da O.S. do Firestore
    useEffect(() => {
        if (!db || !osSettingsDocRef) return;

        const fetchLastOsNumber = async () => {
            try {
                const docSnap = await getDoc(osSettingsDocRef);
                if (docSnap.exists()) {
                    const lastNumber = docSnap.data().lastOsNumber;
                    // Define osNumberInput para o próximo número na sequência
                    setOsForm(prevForm => ({ ...prevForm, osNumber: (lastNumber + 1).toString() }));
                } else {
                    // Se nenhum documento existir, inicializa com 226
                    await setDoc(osSettingsDocRef, { lastOsNumber: 225 }); // Define o inicial para 225 para que o primeiro gerado seja 226
                    setOsForm(prevForm => ({ ...prevForm, osNumber: '226' }));
                }
            } catch (error) {
                console.error("Erro ao carregar o número da O.S.:", error);
            }
        };

        fetchLastOsNumber();
    }, [db, osSettingsDocRef]); // Dependência em db e osSettingsDocRef

    // Lida com as mudanças nos inputs do formulário
    const handleChange = (e) => {
        const { name, value } = e.target;
        setOsForm({
            ...osForm,
            [name]: value,
        });
    };

    // Calcula o valor total (agora apenas o valor do serviço)
    const calculateTotalValue = () => {
        const serviceVal = parseFloat(osForm.serviceValue) || 0;
        return serviceVal.toFixed(2);
    };

    // Define a data para hoje
    const setDateToday = () => {
        setOsForm({ ...osForm, date: new Date().toISOString().split('T')[0] });
    };

    // Define a data para ontem
    const setDateYesterday = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setOsForm({ ...osForm, date: yesterday.toISOString().split('T')[0] });
    };

    // Estilos CSS específicos para impressão e geração de PDF
    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-page-container {
            display: flex;
            justify-content: space-between; /* Espaçamento entre as duas cópias */
            align-items: flex-start; /* Alinha o conteúdo ao topo */
            width: 210mm; /* Largura A4 em mm */
            height: 297mm; /* Altura A4 em mm */
            padding: 5mm; /* Margem da página para preencher mais */
            box-sizing: border-box;
            gap: 2%; /* Pequeno espaçamento entre as cópias */
            overflow: hidden; /* Previne estouro se o conteúdo exceder ligeiramente */
            flex-wrap: nowrap; /* Garante que as cópias não quebrem linha */
        }
        .os-copy {
            width: 49%; /* Mantém a largura para duas cópias */
            box-sizing: border-box;
            border: 1px solid #ccc;
            padding: 8px; /* Preenchimento para espaçamento interno */
            border-radius: 0;
            margin: 0;
            page-break-inside: avoid; /* Importante para manter cada cópia da O.S. intacta */
            font-size: 0.85em; /* Tamanho da fonte base para boa legibilidade */
            line-height: 1.3; /* Espaçamento entre linhas ajustado */
            display: flex;
            flex-direction: column;
            justify-content: flex-start; /* Alinha o conteúdo ao topo */
            height: 100%; /* Permite que a cópia preencha a altura disponível */
            position: relative; /* Para posicionamento de elementos internos */
        }
        .header { text-align: center; margin-bottom: 8px; }
        .header h1 { font-size: 1.6em; margin-bottom: 2px; color: #6a0dad; } /* Título maior */
        .header p { font-size: 0.85em; color: #555; }
        .section-title { font-size: 1.0em; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 10px; margin-bottom: 8px; font-weight: bold; color: #6a0dad;} /* Títulos das seções maiores */
        .info-grid { display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 8px; font-size: 0.85em; } /* Fonte maior para informações */
        .info-item p { margin: 0; padding: 0; }
        .info-item span { font-weight: bold; color: #444; }
        .text-block { border: 1px solid #eee; padding: 6px; min-height: 50px; border-radius: 4px; background-color: #f9f9f9; font-size: 0.85em; overflow: hidden; } /* Bloco de texto maior */
        .footer { margin-top: 15px; text-align: center; font-size: 0.75em; color: #777; width: 100%; } /* Rodapé maior e na parte inferior */
        .signature-line { border-top: 1px dashed #bbb; margin-top: 30px; padding-top: 2px; width: 90%; margin-left: auto; margin-right: auto; }
        .signature-text { text-align: center; margin-top: 3px; }
        @media print {
            button { display: none; }
        }
    `;

    // Função para gerar o conteúdo HTML para uma única cópia da O.S.
    const osContentHtml = (osNum) => `
        <div class="os-copy">
            <div> <!-- Wrapper for content that grows from top -->
                <div class="header">
                    <h1>Jordan Cell</h1>
                    <p>Assistência Técnica Especializada</p>
                    <p>Ordem de Serviço Nº: <span>${osNum}</span> | Data: <span>${osForm.date}</span></p>
                </div>

                <div class="section-title">Dados do Cliente</div>
                <div class="info-grid">
                    <div class="info-item"><p><span>Nome:</span> ${osForm.clientName}</p></div>
                    <div class="info-item"><p><span>Telefone:</span> ${osForm.clientPhone}</p></div>
                </div>

                <div class="section-title">Dados do Aparelho</div>
                <div class="info-grid">
                    <div class="info-item"><p><span>Tipo:</span> ${osForm.deviceName}</p></div>
                </div>

                <div class="section-title">Problema Relatado</div>
                <div class="text-block"><p>${osForm.problemReported || 'N/A'}</p></div>

                <div class="section-title">Serviço Executado / Diagnóstico</div>
                <div class="text-block"><p>${osForm.serviceDescription || 'N/A'}</p></div>

                <div class="section-title">Valores</div>
                <div class="info-grid">
                    <div class="info-item"><p><span>Valor do Serviço:</span> R$ ${parseFloat(osForm.serviceValue || 0).toFixed(2)}</p></div>
                    <div class="info-item"><p><span>Valor Total:</span> R$ ${calculateTotalValue()}</p></div>
                </div>

                <div class="section-title">Garantia</div>
                <p class="text-sm text-gray-600 mt-2">A garantia cobre apenas erros de fabricação da peça. Não haverá troca se a peça apresentar arranhões, trincados ou sinais de queda.</p>
            </div>

            <div class="footer"> <!-- Footer always at the bottom -->
                <div class="signature-line"></div>
                <div class="signature-text">Assinatura do Cliente</div>
                <div class="signature-line mt-10"></div>
                <div class="signature-text">${osForm.technicianName}</div>
            </div>
        </div>
    `;

    // Função para gerar o conteúdo completo da página com duas cópias da O.S. e estilos de impressão
    const printPageContent = (osNum) => `
        <html>
            <head>
                <title>Ordem de Serviço ${osNum}</title>
                <style>${printStyles}</style>
            </head>
            <body>
                <div class="print-page-container">
                    ${osContentHtml(osNum)}
                    ${osContentHtml(osNum)}
                </div>
            </body>
        </html>
    `;

    // Função para atualizar o número da O.S. no Firestore e no estado local
    const updateOsNumber = async () => {
        if (!db || !osSettingsDocRef) return;
        try {
            const currentNumber = parseInt(osForm.osNumber);
            if (!isNaN(currentNumber)) { // Garante que é um número válido antes de salvar
                await setDoc(osSettingsDocRef, { lastOsNumber: currentNumber });
                // Incrementa para o próximo uso, com base no número *atual* após salvar
                setOsForm(prevForm => ({ ...prevForm, osNumber: (currentNumber + 1).toString() }));
            }
        } catch (error) {
            console.error("Erro ao atualizar o número da O.S. no Firestore:", error);
        }
    };

    // Lida com a impressão da Ordem de Serviço
    const handlePrint = async () => {
        if (!db) {
            console.error("Firebase não inicializado.");
            return;
        }

        try {
            const printWindow = window.open('', '_blank'); // Abre em uma nova janela em branco
            if (!printWindow) {
                alert("O pop-up de impressão foi bloqueado. Por favor, permita pop-ups para este site.");
                return;
            }
            printWindow.document.write(printPageContent(osForm.osNumber));
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();

            // Atualiza o número da O.S. após a impressão bem-sucedida
            await updateOsNumber();

            // Reseta os campos do formulário
            setOsForm(prevForm => ({
                ...prevForm,
                date: new Date().toISOString().split('T')[0],
                clientName: '',
                clientPhone: '',
                deviceName: '',
                problemReported: '',
                serviceDescription: '',
                serviceValue: '',
                // osNumber será atualizado por updateOsNumber()
            }));

        } catch (error) {
            console.error("Erro ao gerar O.S. para impressão:", error);
            alert("Erro ao gerar O.S. para impressão. Verifique o console para mais detalhes.");
        }
    };

    // Lida com o download da Ordem de Serviço como PDF
    const handleDownloadPdf = async () => {
        if (typeof window.html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            console.error("Bibliotecas html2canvas ou jspdf não carregadas. Por favor, verifique as CDNs.");
            alert("Erro: Funcionalidade de download PDF não disponível. As bibliotecas necessárias não foram carregadas na sua página principal.");
            return;
        }

        try {
            // Cria uma div temporária para renderizar o conteúdo da O.S. para o PDF
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px'; // Posiciona fora da tela
            tempDiv.innerHTML = printPageContent(osForm.osNumber);
            document.body.appendChild(tempDiv);

            // html2canvas renderiza o conteúdo da div em um canvas
            const canvas = await window.html2canvas(tempDiv.querySelector('.print-page-container'), { scale: 2 }); // Escala para melhor resolução
            const imgData = canvas.toDataURL('image/png');

            // jspdf cria o PDF
            const pdf = new window.jspdf.jsPDF({
                orientation: 'portrait', // A4 geralmente é retrato
                unit: 'mm', // Milímetros como unidade
                format: 'a4', // Formato de papel A4
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pdfWidth; // Faz a largura da imagem se ajustar à largura do PDF
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let position = 0;
            // Adiciona a imagem ao PDF, potencialmente dividindo em várias páginas se for muito alta
            if (imgHeight > pdfHeight) {
                // Se o conteúdo for mais alto que uma página, divide em várias páginas no PDF
                let heightLeft = imgHeight;
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                    if (heightLeft > 0) {
                        pdf.addPage();
                    }
                }
            } else {
                // Conteúdo cabe em uma página
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            }

            pdf.save(`Ordem_Servico_${osForm.osNumber}.pdf`);

            document.body.removeChild(tempDiv); // Limpa a div temporária

            // Atualiza o número da O.S. após o download bem-sucedido
            await updateOsNumber();

            // Reseta os campos do formulário
            setOsForm(prevForm => ({
                ...prevForm,
                date: new Date().toISOString().split('T')[0],
                clientName: '',
                clientPhone: '',
                deviceName: '',
                problemReported: '',
                serviceDescription: '',
                serviceValue: '',
                // osNumber será atualizado por updateOsNumber()
            }));

        } catch (error) {
            console.error("Erro ao gerar PDF da O.S.:", error);
            alert("Erro ao gerar PDF. Verifique o console para mais detalhes.");
        }
    };

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-xl my-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Gerador de Ordem de Serviço</h2>

            <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 bg-gray-50 p-6 rounded-lg shadow-inner">
                {/* Número da O.S. - agora editável e definido automaticamente */}
                <div className="col-span-1">
                    <label htmlFor="osNumber" className="block text-sm font-medium text-gray-700">Nº da O.S.</label>
                    <input type="text" id="osNumber" name="osNumber" value={osForm.osNumber} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Ex: 226"
                    />
                </div>
                {/* Campo de Data com botões Hoje e Ontem */}
                <div className="col-span-1">
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">Data</label>
                    <div className="flex items-center space-x-2 mt-1">
                        <input type="date" id="date" name="date" value={osForm.date} onChange={handleChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                            required
                        />
                        <button
                            type="button"
                            onClick={setDateToday}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors duration-200"
                        >
                            Hoje
                        </button>
                        <button
                            type="button"
                            onClick={setDateYesterday}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-400 rounded-md hover:bg-blue-500 transition-colors duration-200"
                        >
                            Ontem
                        </button>
                    </div>
                </div>
                <div className="col-span-1">
                    <label htmlFor="technicianName" className="block text-sm font-medium text-gray-700">Técnico Responsável</label>
                    <input type="text" id="technicianName" name="technicianName" value={osForm.technicianName} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Nome do Técnico"
                    />
                </div>

                <h3 className="col-span-full text-lg font-semibold text-gray-700 mt-4 border-b pb-2">Dados do Cliente</h3>
                <div className="col-span-full sm:col-span-1">
                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">Nome do Cliente</label>
                    <input type="text" id="clientName" name="clientName" value={osForm.clientName} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Nome Completo"
                        required
                    />
                </div>
                <div className="col-span-full sm:col-span-1">
                    <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700">Telefone</label>
                    <input type="tel" id="clientPhone" name="clientPhone" value={osForm.clientPhone} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="(XX) XXXX-XXXX"
                    />
                </div>

                <h3 className="col-span-full text-lg font-semibold text-gray-700 mt-4 border-b pb-2">Dados do Aparelho</h3>
                <div className="col-span-full sm:col-span-1">
                    <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700">Tipo de Aparelho</label>
                    <input type="text" id="deviceName" name="deviceName" value={osForm.deviceName} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Ex: Smartphone, Notebook"
                    />
                </div>

                <div className="col-span-full">
                    <label htmlFor="problemReported" className="block text-sm font-medium text-gray-700">Problema Relatado</label>
                    <textarea id="problemReported" name="problemReported" rows="3" value={osForm.problemReported} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Descreva o problema que o cliente relatou..."
                    ></textarea>
                </div>

                <div className="col-span-full">
                    <label htmlFor="serviceDescription" className="block text-sm font-medium text-gray-700">Serviço Executado / Diagnóstico</label>
                    <textarea id="serviceDescription" name="serviceDescription" rows="3" value={osForm.serviceDescription} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        placeholder="Detalhes do serviço realizado ou diagnóstico..."
                    ></textarea>
                </div>

                <h3 className="col-span-full text-lg font-semibold text-gray-700 mt-4 border-b pb-2">Valores</h3>
                <div className="col-span-full sm:col-span-1">
                    <label htmlFor="serviceValue" className="block text-sm font-medium text-gray-700">Valor do Serviço (R$)</label>
                    <input type="number" id="serviceValue" name="serviceValue" value={osForm.serviceValue} onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        step="0.01" min="0" placeholder="0.00"
                    />
                </div>
                <div className="col-span-full sm:col-span-1">
                    <label htmlFor="totalValue" className="block text-sm font-medium text-gray-700">Valor Total (R$)</label>
                    <input type="text" id="totalValue" name="totalValue" value={calculateTotalValue()} readOnly
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600 sm:text-sm"
                    />
                </div>

                <div className="col-span-full flex justify-center space-x-4 mt-6">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex justify-center py-3 px-8 border border-transparent shadow-md text-lg font-medium rounded-full text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 transform hover:scale-105"
                    >
                        Gerar e Imprimir O.S.
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="inline-flex justify-center py-3 px-8 border border-transparent shadow-md text-lg font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 transform hover:scale-105"
                    >
                        Baixar PDF
                    </button>
                </div>
            </form>
        </div>
    );
};

// Componente Principal da Aplicação
const App = () => {
    const [currentPage, setCurrentPage] = useState('services'); // 'services' ou 'os_generator'

    const handleNavigate = (page) => {
        setCurrentPage(page);
    };

    return (
        <FirebaseProvider>
            <div className="min-h-screen bg-gray-100 font-sans antialiased text-gray-900">
                <style>
                    {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
                    body { font-family: 'Inter', sans-serif; }
                    /* Scrollbar customizado para melhor estética */
                    ::-webkit-scrollbar {
                        width: 8px;
                    }
                    ::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 10px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #888;
                        border-radius: 10px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #555;
                    }
                    `}
                </style>
                <Header onNavigate={handleNavigate} currentPage={currentPage} />
                <main>
                    {currentPage === 'services' && <ServiceRegistration />}
                    {currentPage === 'os_generator' && <OSGenerator />}
                </main>
            </div>
        </FirebaseProvider>
    );
};

export default App;
