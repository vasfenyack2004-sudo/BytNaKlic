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
  deleteDoc, doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc, updateDoc
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

// Пакет для сповіщень
import emailjs from '@emailjs/browser';

// Ініціалізація EmailJS твоїм НОВИМ ключем
emailjs.init("klUWyK6E3q0jVSWat");

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
  
  // Auth & Profile fields
  const [emailAuth, setEmailAuth] = useState('');
  const [passwordAuth, setPasswordAuth] = useState('');
  const [registerRole, setRegisterRole] = useState<'MASTER' | 'CLIENT'>('MASTER');
  const [regIco, setRegIco] = useState('');
  const [profileIco, setProfileIco] = useState('');
  const [birthYear, setBirthYear] = useState('');

  // Form fields
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
        const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setProfileIco(data.ico && data.ico !== '—' ? data.ico : '');
            setBirthYear(data.birthYear || '');
          }
        });
        return () => unsubUser();
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
    if (!emailAuth || !passwordAuth) return Alert.alert("Chyba", "Vyplňte pole.");
    setLoading(true);
    try {
      if (authMode === 'REGISTER') {
        const userCred = await createUserWithEmailAndPassword(auth, emailAuth, passwordAuth);
        await setDoc(doc(db, "users", userCred.user.uid), {
          email: emailAuth, role: registerRole, ico: regIco || "—", birthYear: "", createdAt: new Date()
        });
        setView('PROFILE');
      } else { 
        await signInWithEmailAndPassword(auth, emailAuth, passwordAuth); 
        setView('FORM');
      }
      setIsMenuOpen(false);
    } catch (e) { Alert.alert("Chyba", "Nepodařilo se."); }
    finally { setLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!birthYear) return Alert.alert("Pozor", "Rok narození є povinný.");
    setLoading(true);
    try {
      await setDoc(doc(db, "users", currentUser!.uid), { ico: profileIco || "—", birthYear }, { merge: true });
      Alert.alert("Úspěch", "Uloženo."); setView('FORM');
    } catch (e) { Alert.alert("Chyba", "Chyba uložení."); }
    finally { setLoading(false); }
  };

  const handleSubmitOrder = async () => {
    if (!title || !phone || selectedCats.length === 0) return Alert.alert("Pozor", "Doplňte pole.");
    setLoading(true);
    const initialStatus = currentUser?.email === ADMIN_EMAIL ? 'APPROVED' : 'PENDING';
    try {
      await addDoc(collection(db, "poptavky"), {
        title, description: desc, price, phone, email: emailOrder || "neuvedeno",
        categories: selectedCats, createdAt: new Date(), views: 0, status: initialStatus 
      });
      if (initialStatus === 'PENDING') {
        await emailjs.send('service_9flz7xf', 'template_dsxyb8h', { title, phone, desc }, 'klUWyK6E3q0jVSWat');
      }
      setTitle(''); setDesc(''); setPhone(''); setSelectedCats([]);
      setIsFormExpanded(false); 
      Alert.alert("Hotovo", "Odesláno.");
    } catch (e) { Alert.alert("Chyba", "Nezdařilo se."); }
    finally { setLoading(false); }
  };

  const Footer = () => (
    <View style={styles.footerContainer}>
      <View style={styles.footerDivider} />
      <Text style={styles.footerText}>© 2026 <Text style={{color: '#FFD700'}}>BytNaKlič</Text>. Premium ČR.</Text>
    </View>
  );

  const visibleOrders = orders.filter(o => o.status === 'APPROVED' || currentUser?.email === ADMIN_EMAIL);

  return (
    <ImageBackground 
      // 1. СПРАВЖНЯ ЧЕРВОНА ЦЕГЛА
      source={{ uri: 'https://images.unsplash.com/photo-1523464860987-991c49980d46?q=80&w=1000&auto=format&fit=crop' }} 
      style={styles.backgroundImage}
      imageStyle={{ opacity: 1 }}
    >
      <View style={styles.darkOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <StatusBar barStyle="light-content" />
          
          <View style={styles.header}>
            <Text style={styles.logo}>BYT<Text style={{color: '#FFD700'}}>NAKLÍČ</Text></Text>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setIsMenuOpen(true)}>
              <Ionicons name="person-outline" size={20} color="#FFD700" />
              {currentUser && !isProfileComplete() && <View style={styles.badge} />}
            </TouchableOpacity>
          </View>

          {isMenuOpen && (
            <View style={styles.floatingMenu}>
              <Text style={styles.menuTitleText}>{currentUser ? currentUser.email : "HOST"}</Text>
              <View style={styles.menuDivider} />
              {currentUser ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('PROFILE'); setIsMenuOpen(false);}}>
                    <Ionicons name="settings-outline" size={18} color="#FFD700" style={{marginRight: 10}} />
                    <Text style={styles.menuText}>Můj profil</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {signOut(auth); setIsMenuOpen(false); setView('FORM');}}>
                    <Ionicons name="log-out-outline" size={18} color="#FFD700" style={{marginRight: 10}} />
                    <Text style={styles.menuText}>Odhlásit se</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.menuItem} onPress={() => {setView('AUTH'); setIsMenuOpen(false);}}>
                  <Ionicons name="log-in-outline" size={18} color="#FFD700" style={{marginRight: 10}} />
                  <Text style={styles.menuText}>Vstup pro mistry</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setIsMenuOpen(false)} style={{marginTop: 15}}><Text style={{color: '#FFD700', textAlign: 'center'}}>Zavřít</Text></TouchableOpacity>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {view === 'FORM' && (
              <>
                <View style={styles.emblemContainer}><Ionicons name="construct-outline" size={60} color="#FFD700" style={styles.glowIcon} /></View>
                
                <View style={[styles.card, {borderColor: '#00BFFF'}]}>
                  <TouchableOpacity style={styles.formHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsFormExpanded(!isFormExpanded); }}>
                    <Text style={styles.formTitle}>Nová poptávka</Text>
                    <Ionicons name={isFormExpanded ? "chevron-up" : "chevron-down"} size={24} color="#FFF" />
                  </TouchableOpacity>
                  {isFormExpanded && (
                    <View style={styles.formBody}>
                      <TextInput style={styles.input} placeholder="Název" placeholderTextColor="#999" value={title} onChangeText={setTitle} />
                      <TextInput style={[styles.input, {height: 60}]} placeholder="Popis..." multiline placeholderTextColor="#999" value={desc} onChangeText={setDesc} />
                      <TextInput style={styles.input} placeholder="Telefon" keyboardType="phone-pad" placeholderTextColor="#999" value={phone} onChangeText={setPhone} />
                      <View style={styles.catGrid}>{CATEGORIES.map(c => (<TouchableOpacity key={c} style={[styles.chip, selectedCats.includes(c) && styles.chipActive]} onPress={() => selectedCats.includes(c) ? setSelectedCats(selectedCats.filter(x => x !== c)) : setSelectedCats([...selectedCats, c])}><Text style={[styles.chipText, selectedCats.includes(c) && {color: '#000'}]}>{c}</Text></TouchableOpacity>))}</View>
                      <TouchableOpacity style={styles.goldBtn} onPress={handleSubmitOrder}><Text style={styles.goldBtnText}>PUBLIKOVAT</Text></TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* СТАТИСТИКА ПОВЕРНУТА */}
                <View style={styles.statsContainer}>
                   <View style={styles.statBox}><Text style={styles.statLabel}>Týden</Text><Text style={styles.statValue}>{visibleOrders.length}</Text></View>
                   <View style={[styles.statBox, {borderLeftWidth:1, borderColor:'#444'}]}><Text style={styles.statLabel}>Aktivní</Text><Text style={styles.statValue}>{visibleOrders.length}</Text></View>
                </View>

                <View style={styles.listSection}>
                  <Text style={styles.sectionTitle}>Aktuální zakázky</Text>
                  {visibleOrders.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.orderCard} onPress={() => handleOpenOrder(item)}>
                      <Text style={styles.orderCats}>{item.categories[0]}</Text>
                      <Text style={styles.orderTitle}>{item.title}</Text>
                      <Text style={styles.orderPrice}>{item.price} Kč</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Footer />
              </>
            )}

            {view === 'AUTH' && (
              <View style={[styles.card, {marginTop: 40}]}>
                <Text style={styles.formTitle}>{authMode === 'LOGIN' ? 'Přihlášení' : 'Registrace'}</Text>
                <TextInput style={[styles.input, {marginTop: 20}]} placeholder="Email" placeholderTextColor="#666" value={emailAuth} onChangeText={setEmailAuth} autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="Heslo" secureTextEntry placeholderTextColor="#666" value={passwordAuth} onChangeText={setPasswordAuth} />
                <TouchableOpacity style={styles.goldBtn} onPress={handleAuth}><Text style={styles.goldBtnText}>POKRAČОВАТ</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} style={{marginTop: 20}}><Text style={{color: '#FFD700', textAlign: 'center'}}>Změnit režim</Text></TouchableOpacity>
              </View>
            )}

            {view === 'PROFILE' && (
               <View style={[styles.card, {marginTop: 40}]}>
                  <Text style={styles.formTitle}>Můj profil</Text>
                  <Text style={styles.label}>Rok narození:</Text>
                  <TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="1995" keyboardType="numeric" placeholderTextColor="#666" />
                  <TouchableOpacity style={styles.goldBtn} onPress={handleSaveProfile}><Text style={styles.goldBtnText}>ULOŽIT</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setView('FORM')} style={{marginTop: 15}}><Text style={{color: '#888', textAlign: 'center'}}>Zpět</Text></TouchableOpacity>
               </View>
            )}
          </ScrollView>

          <Modal visible={!!selectedOrder} animationType="slide" transparent>
            <View style={styles.modalOverlay}><View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}><Ionicons name="close" size={30} color="#FFD700" /></TouchableOpacity>
                {selectedOrder && (<ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalTitle}>{selectedOrder.title}</Text>
                    <Text style={styles.modalDesc}>{selectedOrder.description}</Text>
                    <View style={styles.modalPriceBox}><Text style={{color: '#888'}}>CENA:</Text><Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 18}}>{selectedOrder.price} Kč</Text></View>
                    
                    {/* 2. ЗАХИСТ ДЛЯ ГОСТЕЙ ВИПРАВЛЕНО */}
                    <TouchableOpacity 
                      style={styles.callBtn} 
                      onPress={() => { 
                        if(!currentUser) {
                          Alert.alert(
                            "Nutná registrace", 
                            "Pro zobrazení kontaktu se musєте nejdříve přihlásit.",
                            [
                              { text: "Zavřít", style: "cancel" },
                              { text: "Přihlásit se", onPress: () => { setSelectedOrder(null); setView('AUTH'); } }
                            ]
                          );
                          return;
                        } 
                        if(!isProfileComplete()) {
                          Alert.alert("Profil", "Doplňte rok narození pro zobrazení kontaktů.");
                          setSelectedOrder(null); setView('PROFILE');
                          return;
                        } 
                        Alert.alert("Kontakt", "Číslo: " + selectedOrder.phone); 
                      }}
                    >
                      <Ionicons name="call" size={20} color="#000" />
                      <Text style={styles.callBtnText}>{maskContact(selectedOrder.phone, 'phone')}</Text>
                    </TouchableOpacity>

                    {currentUser?.email === ADMIN_EMAIL && (
                      <TouchableOpacity style={{marginTop: 30, padding: 15, backgroundColor: 'rgba(255,0,0,0.2)', borderRadius: 10, borderWidth: 1, borderColor: 'red'}} onPress={async()=>{await deleteDoc(doc(db,"poptavky",selectedOrder.id)); setSelectedOrder(null);}}>
                        <Text style={{color: 'red', textAlign: 'center', fontWeight: 'bold'}}>SMAZAT ZAKÁZKU</Text>
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
  darkOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)' }, // Легке затемнення, щоб цеглу було видно
  header: { paddingTop: 60, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 },
  logo: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  profileBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, borderWidth: 1, borderColor: '#444' },
  badge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4444' },
  floatingMenu: { position: 'absolute', top: 110, right: 25, width: 200, backgroundColor: '#111', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#FFD700', zIndex: 1000 },
  menuTitleText: { color: '#FFD700', fontSize: 10, textAlign: 'center', marginBottom: 5 },
  menuDivider: { height: 1, backgroundColor: '#333', marginVertical: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  menuText: { color: '#FFF' },
  scrollContent: { paddingBottom: 60, alignItems: 'center' },
  emblemContainer: { marginVertical: 20 },
  glowIcon: { textShadowColor: '#FFD700', textShadowRadius: 15 },
  card: { backgroundColor: 'rgba(15, 15, 20, 0.95)', width: '92%', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  formBody: { marginTop: 15 },
  input: { backgroundColor: '#111', color: '#FFF', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  chip: { padding: 8, borderRadius: 6, backgroundColor: '#222' },
  chipActive: { backgroundColor: '#FFD700' },
  chipText: { color: '#888', fontSize: 10, fontWeight: 'bold' },
  goldBtn: { backgroundColor: '#FFD700', padding: 15, borderRadius: 12, alignItems: 'center' },
  goldBtnText: { color: '#000', fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', width: '92%', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 15, padding: 15, marginTop: 15 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#666', fontSize: 10 },
  statValue: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  listSection: { width: '92%', marginTop: 20 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  orderCard: { backgroundColor: 'rgba(20,20,25,0.9)', borderRadius: 15, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  orderCats: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
  orderTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  orderPrice: { color: '#00BFFF', fontSize: 13, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111', width: '90%', borderRadius: 20, padding: 20 },
  closeBtn: { alignSelf: 'flex-end' },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalDesc: { color: '#AAA', fontSize: 15, lineHeight: 22, marginBottom: 15 },
  modalPriceBox: { backgroundColor: '#1A1A24', padding: 15, borderRadius: 10, marginBottom: 20 },
  callBtn: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 12, gap: 10 },
  callBtnText: { color: '#000', fontWeight: 'bold' },
  footerContainer: { marginTop: 40, alignItems: 'center', width: '100%' },
  footerDivider: { width: '30%', height: 1, backgroundColor: '#444', marginBottom: 15 },
  footerText: { color: '#555', fontSize: 11 },
  label: { color: '#888', fontSize: 12, marginBottom: 5 }
});