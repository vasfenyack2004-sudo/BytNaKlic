import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';

// Firebase Config
import { Ionicons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc, updateDoc
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

// Пакет для сповіщень на пошту
import emailjs from '@emailjs/browser';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ADMIN_EMAIL = 'vas.fenyack2004@gmail.com'; 

interface Poptavka {
  id: string; title: string; description: string;
  price: string; phone: string; email?: string;
  categories: string[]; createdAt: any; views: number;
  status?: 'PENDING' | 'APPROVED';
}

export default function App() {
  const [view, setView] = useState<'FORM' | 'AUTH' | 'PROFILE'>('FORM');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null); 
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [orders, setOrders] = useState<Poptavka[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Poptavka | null>(null);
  
  const [emailAuth, setEmailAuth] = useState('');
  const [passwordAuth, setPasswordAuth] = useState('');
  const [registerRole, setRegisterRole] = useState<'MASTER' | 'CLIENT'>('MASTER');
  const [regIco, setRegIco] = useState('');
  
  const [profileIco, setProfileIco] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [emailOrder, setEmailOrder] = useState('');

  const CATEGORIES = ['ZEDNÍK', 'MALÍŘ', 'STAVEBNÍK', 'ELEKTRIKÁŘ', 'INSTALATÉR', 'PODLAHÁŘ', 'ÚKLID', 'ZAHRADA', 'STĚHOVÁNÍ'];

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setProfileIco(data.ico && data.ico !== '—' ? data.ico : '');
            setBirthYear(data.birthYear || '');
          }
        });
      } else { setUserData(null); }
    });

    const q = query(collection(db, "poptavky"), orderBy("createdAt", "desc"));
    const unsubDocs = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Poptavka[]);
    });
    return () => { unsubAuth(); unsubDocs(); };
  }, []);

  const isProfileComplete = () => {
    if (currentUser?.email === ADMIN_EMAIL) return true;
    if (!userData) return false;
    if (userData.role === 'MASTER') return !!userData.birthYear && !!userData.ico && userData.ico !== '—';
    return !!userData.birthYear; 
  };

  const maskContact = (text: string, type: 'phone' | 'email') => {
    if (currentUser?.email === ADMIN_EMAIL || isProfileComplete()) return text;
    return type === 'phone' ? text.substring(0, 4) + " *** *** ***" : "***@***.cz";
  };

  const handleOpenOrder = async (order: Poptavka) => {
    setSelectedOrder(order);
    try { await updateDoc(doc(db, "poptavky", order.id), { views: increment(1) }); } catch(e){}
  };

  const handleAuth = async () => {
    if (!emailAuth || !passwordAuth) return Alert.alert("Chyba", "Vyplňte všechna pole.");
    setLoading(true);
    try {
      if (authMode === 'REGISTER') {
        const userCred = await createUserWithEmailAndPassword(auth, emailAuth, passwordAuth);
        await setDoc(doc(db, "users", userCred.user.uid), {
          email: emailAuth, role: emailAuth === ADMIN_EMAIL ? 'SUPER_ADMIN' : registerRole, 
          ico: regIco || "—", birthYear: "", createdAt: new Date()
        });
        setView('PROFILE');
      } else { 
        await signInWithEmailAndPassword(auth, emailAuth, passwordAuth); 
        setView('FORM');
      }
      setIsMenuOpen(false);
    } catch (e) { Alert.alert("Chyba", "Nepodařilo se přihlásit."); }
    finally { setLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!birthYear) return Alert.alert("Pozor", "Rok narození je povinný.");
    setLoading(true);
    try {
      await setDoc(doc(db, "users", currentUser!.uid), { ico: profileIco || "—", birthYear }, { merge: true });
      Alert.alert("Úspěch", "Profil uložen."); setView('FORM');
    } catch (e) { Alert.alert("Chyba", "Data nebyla uložena."); }
    finally { setLoading(false); }
  };

  // ОНОВЛЕНА ФУНКЦІЯ З EMAILJS
  const handleSubmitOrder = async () => {
    if (!title || !phone || selectedCats.length === 0) return Alert.alert("Pozor", "Doplňte název, telefon a kategorii.");
    setLoading(true);
    
    const initialStatus = currentUser?.email === ADMIN_EMAIL ? 'APPROVED' : 'PENDING';
    
    try {
      // 1. Зберігаємо в Firebase
      await addDoc(collection(db, "poptavky"), {
        title, description: desc, price, phone, email: emailOrder || "neuvedeno",
        categories: selectedCats, createdAt: new Date(), views: 0, status: initialStatus 
      });

      // 2. Відправляємо лист адміну через EmailJS (якщо створив клієнт)
      if (initialStatus === 'PENDING') {
        emailjs.send(
          'service_pvh9nup', 
          'template_900lkhl', 
          { title, phone, desc: desc || "Bez popisu" }, 
          'p63C0rEaH2E5I7u_o'
        ).then(() => console.log('Email sent!')).catch(err => console.log('Email error:', err));
      }

      setTitle(''); setDesc(''); setPrice(''); setPhone(''); setEmailOrder(''); setSelectedCats([]);
      setIsFormExpanded(false); 
      
      if (initialStatus === 'APPROVED') {
         Alert.alert("Hotovo", "Zakázka byla publikována.");
      } else {
         Alert.alert("Odesláno", "Zakázka čeká na schválení. Přijde vám potvrzení na email.");
      }
    } catch (e) { Alert.alert("Chyba", "Odeslání selhalo."); }
    finally { setLoading(false); }
  };

  const Footer = () => (
    <View style={styles.footerContainer}>
      <View style={styles.footerDivider} />
      <Text style={styles.footerText}>© 2026 <Text style={{color: '#FFD700'}}>BytNaKlič</Text>. Premium Servis. </Text>
      <Text style={styles.footerText}>Všechna práva vyhrazena.</Text>
    </View>
  );

  const visibleOrders = orders.filter(o => o.status === 'APPROVED' || currentUser?.email === ADMIN_EMAIL);

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=1000&auto=format&fit=crop' }} 
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.4 }}
    >
      <View style={styles.darkOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <StatusBar barStyle="light-content" />
          
          <View style={styles.header}>
            <Text style={styles.logo}>BYT<Text style={{color: '#FFD700'}}>NAKLÍČ</Text></Text>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setIsMenuOpen(true)}>
              <Ionicons name="person-outline" size={20} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {isMenuOpen && (
            <View style={styles.floatingMenu}>
                <TouchableOpacity onPress={() => {setView('PROFILE'); setIsMenuOpen(false);}}><Text style={styles.menuText}>Můj profil</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {signOut(auth); setView('FORM'); setIsMenuOpen(false);}}><Text style={[styles.menuText, {marginTop: 15}]}>Odhlásit se</Text></TouchableOpacity>
                <TouchableOpacity style={{marginTop: 20}} onPress={() => setIsMenuOpen(false)}><Text style={{color: '#FFD700'}}>Zavřít</Text></TouchableOpacity>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {view === 'FORM' && (
              <>
                <View style={styles.emblemContainer}><Ionicons name="construct-outline" size={60} color="#FFD700" /></View>
                <View style={[styles.card, {borderColor: '#00BFFF'}]}>
                  <TouchableOpacity style={styles.formHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsFormExpanded(!isFormExpanded); }}>
                    <Text style={styles.formTitle}>Nová poptávka</Text>
                    <Ionicons name={isFormExpanded ? "chevron-up" : "chevron-down"} size={24} color="#FFF" />
                  </TouchableOpacity>
                  {isFormExpanded && (
                    <View style={styles.formBody}>
                      <TextInput style={styles.input} placeholder="Název" placeholderTextColor="#999" value={title} onChangeText={setTitle} />
                      <TextInput style={[styles.input, {height: 60}]} placeholder="Popis" multiline placeholderTextColor="#999" value={desc} onChangeText={setDesc} />
                      <TextInput style={styles.input} placeholder="Telefon" keyboardType="phone-pad" placeholderTextColor="#999" value={phone} onChangeText={setPhone} />
                      <View style={styles.catGrid}>{CATEGORIES.map(c => (<TouchableOpacity key={c} style={[styles.chip, selectedCats.includes(c) && styles.chipActive]} onPress={() => selectedCats.includes(c) ? setSelectedCats(selectedCats.filter(x => x !== c)) : setSelectedCats([...selectedCats, c])}><Text style={[styles.chipText, selectedCats.includes(c) && {color: '#000'}]}>{c}</Text></TouchableOpacity>))}</View>
                      <TouchableOpacity style={styles.goldBtn} onPress={handleSubmitOrder}><Text style={styles.goldBtnText}>PUBLIKOVAT</Text></TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.listSection}>
                  <Text style={styles.sectionTitle}>Zakázky</Text>
                  {visibleOrders.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.orderCard} onPress={() => handleOpenOrder(item)}>
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderCats}>{item.categories[0]}</Text>
                        {item.status === 'PENDING' && <Text style={{color: '#FFA500', fontSize: 10}}>⏳ ČEKÁ</Text>}
                      </View>
                      <Text style={styles.orderTitle}>{item.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Footer />
              </>
            )}
            {view === 'AUTH' && (
                <View style={[styles.card, {marginTop: 50}]}>
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#666" value={emailAuth} onChangeText={setEmailAuth} />
                    <TextInput style={styles.input} placeholder="Heslo" secureTextEntry placeholderTextColor="#666" value={passwordAuth} onChangeText={setPasswordAuth} />
                    <TouchableOpacity style={styles.goldBtn} onPress={handleAuth}><Text style={styles.goldBtnText}>PŘIHLÁSIT</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}><Text style={{color: '#FFD700', marginTop: 20, textAlign: 'center'}}>Změnit na {authMode === 'LOGIN' ? 'Registraci' : 'Přihlášení'}</Text></TouchableOpacity>
                </View>
            )}
            {view === 'PROFILE' && (
                <View style={[styles.card, {marginTop: 50}]}>
                    <Text style={styles.label}>Rok narození:</Text>
                    <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="1995" keyboardType="numeric" placeholderTextColor="#666" />
                    <TouchableOpacity style={styles.goldBtn} onPress={handleSaveProfile}><Text style={styles.goldBtnText}>ULOŽIT</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setView('FORM')}><Text style={{color: '#888', marginTop: 20, textAlign: 'center'}}>Zpět</Text></TouchableOpacity>
                </View>
            )}
          </ScrollView>

          <Modal visible={!!selectedOrder} animationType="slide" transparent>
            <View style={styles.modalOverlay}><View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}><Ionicons name="close" size={28} color="#FFD700" /></TouchableOpacity>
                {selectedOrder && (<ScrollView>
                    <Text style={styles.modalTitle}>{selectedOrder.title}</Text>
                    <Text style={styles.modalDesc}>{selectedOrder.description}</Text>
                    <Text style={styles.infoValue}>Kontakt: {maskContact(selectedOrder.phone, 'phone')}</Text>
                    
                    {currentUser?.email === ADMIN_EMAIL && selectedOrder.status === 'PENDING' && (
                      <TouchableOpacity 
                        style={[styles.goldBtn, {marginTop: 20, backgroundColor: '#00BFFF'}]} 
                        onPress={async()=>{
                          await updateDoc(doc(db,"poptavky",selectedOrder.id), {status: 'APPROVED'}); 
                          setSelectedOrder(null);
                        }}>
                        <Text style={styles.goldBtnText}>SCHVÁLIT ZAKÁZKU</Text>
                      </TouchableOpacity>
                    )}
                    {currentUser?.email === ADMIN_EMAIL && (
                      <TouchableOpacity 
                        style={{marginTop: 15, padding: 10, borderColor: 'red', borderWidth: 1, borderRadius: 10}} 
                        onPress={async()=>{await deleteDoc(doc(db,"poptavky",selectedOrder.id)); setSelectedOrder(null);}}>
                        <Text style={{color: 'red', textAlign: 'center'}}>Smazat</Text>
                      </TouchableOpacity>
                    )}
                </ScrollView>)}
            </View></View>
          </Modal>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, backgroundColor: '#000' },
  darkOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  header: { paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  profileBtn: { padding: 10, backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  floatingMenu: { position: 'absolute', top: 100, right: 20, width: 200, backgroundColor: '#111', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#FFD700', zIndex: 100 },
  menuText: { color: '#FFF', fontSize: 16 },
  scrollContent: { paddingBottom: 100, alignItems: 'center' },
  emblemContainer: { marginVertical: 30 },
  card: { backgroundColor: 'rgba(15, 15, 20, 0.9)', width: '90%', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  formTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  formBody: { marginTop: 15 },
  input: { backgroundColor: '#000', color: '#FFF', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 15 },
  chip: { padding: 8, borderRadius: 5, backgroundColor: '#222' },
  chipActive: { backgroundColor: '#FFD700' },
  chipText: { color: '#888', fontSize: 10 },
  goldBtn: { backgroundColor: '#FFD700', padding: 15, borderRadius: 10, alignItems: 'center' },
  goldBtnText: { color: '#000', fontWeight: 'bold' },
  listSection: { width: '90%', marginTop: 30 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  orderCard: { backgroundColor: '#111', borderRadius: 15, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  orderCats: { color: '#FFD700', fontSize: 10 },
  orderTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '80%' },
  closeBtn: { alignSelf: 'flex-end' },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  modalDesc: { color: '#AAA', fontSize: 16, marginVertical: 15 },
  infoValue: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  footerContainer: { marginTop: 50, alignItems: 'center', width: '100%' },
  footerDivider: { width: '30%', height: 1, backgroundColor: '#FFD700', marginBottom: 10 },
  footerText: { color: '#555', fontSize: 10 },
  label: { color: '#888', marginBottom: 5 }
});