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
  
  // Auth fields
  const [emailAuth, setEmailAuth] = useState('');
  const [passwordAuth, setPasswordAuth] = useState('');
  const [registerRole, setRegisterRole] = useState<'MASTER' | 'CLIENT'>('MASTER');
  const [regIco, setRegIco] = useState('');
  
  // Profile fields
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
    // Важливо: Ініціалізація EmailJS твоїм ключем
    emailjs.init("Plwz8uPyle__rci_b");

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
    if (!emailAuth || !passwordAuth) return Alert.alert("Chyba", "Vyplňte všechna pole.");
    if (authMode === 'REGISTER' && registerRole === 'MASTER' && !regIco) return Alert.alert("Pozor", "IČO je povinné.");
    setLoading(true);
    try {
      if (authMode === 'REGISTER') {
        const userCred = await createUserWithEmailAndPassword(auth, emailAuth, passwordAuth);
        await setDoc(doc(db, "users", userCred.user.uid), {
          email: emailAuth, role: emailAuth === ADMIN_EMAIL ? 'SUPER_ADMIN' : registerRole, 
          ico: regIco || "—", birthYear: "", createdAt: new Date()
        });
        setView(emailAuth === ADMIN_EMAIL ? 'FORM' : 'PROFILE');
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

  const handleSubmitOrder = async () => {
    if (!title || !phone || selectedCats.length === 0) return Alert.alert("Pozor", "Doplňte název, telefon a kategorii.");
    setLoading(true);
    
    const initialStatus = currentUser?.email === ADMIN_EMAIL ? 'APPROVED' : 'PENDING';
    
    try {
      // 1. ЗАПИСУЄМО В FIREBASE
      await addDoc(collection(db, "poptavky"), {
        title, description: desc, price, phone, email: emailOrder || "neuvedeno",
        categories: selectedCats, createdAt: new Date(), views: 0, status: initialStatus 
      });

      // 2. ВІДПРАВЛЯЄМО ЛИСТ (з діагностикою)
      if (initialStatus === 'PENDING') {
        emailjs.send(
          'service_9flz7xf', 
          'template_dsxyb8h', 
          { 
            title: title, 
            phone: phone, 
            desc: desc || "Bez popisu",
            email: emailOrder || "neuvedeno"
          }, 
          'Plwz8uPyle__rci_b'
        )
        .then((res) => console.log('Email sent!', res.status))
        .catch((err) => {
          console.error('Email failed:', err);
          Alert.alert("Email Error", "Zakázka uložena, ale admin nedostal email.");
        });
      }

      setTitle(''); setDesc(''); setPrice(''); setPhone(''); setEmailOrder(''); setSelectedCats([]);
      setIsFormExpanded(false); 
      
      Alert.alert("Hotovo", initialStatus === 'APPROVED' ? "Zakázka byla publikována." : "Odesláno ke schválení. Email adminovi byl odeslán.");

    } catch (e: any) { 
      console.error('Firebase error:', e);
      Alert.alert("Chyba", "Nepodařilo se uložit zakázku."); 
    } finally { 
      setLoading(false); 
    }
  };

  const Footer = () => (
    <View style={styles.footerContainer}>
      <View style={styles.footerDivider} />
      <Text style={styles.footerText}>
        © 2026 <Text style={{color: '#FFD700'}}>BytNaKlič</Text>. Premium Servis в ČR.
      </Text>
      <Text style={styles.footerText}>Všechna práva vyhrazena.</Text>
    </View>
  );

  const visibleOrders = orders.filter(o => o.status === 'APPROVED' || currentUser?.email === ADMIN_EMAIL);

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?q=80&w=1000&auto=format&fit=crop' }} 
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
              {currentUser && !isProfileComplete() && <View style={styles.badge} />}
            </TouchableOpacity>
          </View>

          {isMenuOpen && <TouchableOpacity style={styles.menuCloseOverlay} activeOpacity={1} onPress={() => setIsMenuOpen(false)} />}

          {isMenuOpen && (
            <View style={styles.floatingMenu}>
              <Text style={styles.menuTitleText}>{currentUser ? currentUser.email : "UŽIVATEL"}</Text>
              <View style={styles.menuDivider} />
              {currentUser ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('PROFILE'); setIsMenuOpen(false);}}>
                    <Ionicons name="person-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <View><Text style={styles.menuText}>Můj profil</Text>{!isProfileComplete() && <Text style={styles.warningText}>⚠️ Dokončit registraci</Text>}</View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('FORM'); setIsMenuOpen(false);}}><Ionicons name="list-outline" size={18} color="#FFD700" style={styles.menuIcon} /><Text style={styles.menuText}>Nástěnka zakázek</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {signOut(auth); setIsMenuOpen(false); setView('FORM');}}><Ionicons name="log-out-outline" size={18} color="#FFD700" style={styles.menuIcon} /><Text style={styles.menuText}>Odhlásit se</Text></TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.menuItem} onPress={() => {setView('AUTH'); setIsMenuOpen(false);}}><Ionicons name="log-in-outline" size={18} color="#FFD700" style={styles.menuIcon} /><Text style={styles.menuText}>Vstup pro mistry</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.menuItem, {marginTop: 10, borderTopWidth: 1, borderColor: '#333'}]} onPress={() => setIsMenuOpen(false)}><Text style={{color: '#FFD700', width: '100%', textAlign: 'center', paddingTop: 10}}>Zavřít</Text></TouchableOpacity>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {view === 'FORM' && (
              <>
                <View style={styles.emblemContainer}><Ionicons name="construct-outline" size={60} color="#FFD700" style={styles.glowIcon} /></View>
                <View style={[styles.card, styles.neonBlueBorder]}>
                  <TouchableOpacity style={styles.formHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsFormExpanded(!isFormExpanded); }}>
                    <Text style={styles.formTitle}>Nová poptávka</Text>
                    <Ionicons name={isFormExpanded ? "chevron-up" : "chevron-down"} size={24} color="#FFF" />
                  </TouchableOpacity>
                  {isFormExpanded && (
                    <View style={styles.formBody}>
                      <TextInput style={styles.input} placeholder="Název zakázky" placeholderTextColor="#999" value={title} onChangeText={setTitle} />
                      <TextInput style={[styles.input, {height: 80}]} placeholder="Detailní popis..." multiline placeholderTextColor="#999" value={desc} onChangeText={setDesc} />
                      <TextInput style={styles.input} placeholder="Rozpočet (Kč)" keyboardType="numeric" placeholderTextColor="#999" value={price} onChangeText={setPrice} />
                      <TextInput style={styles.input} placeholder="Telefon" keyboardType="phone-pad" placeholderTextColor="#999" value={phone} onChangeText={setPhone} />
                      <TextInput style={styles.input} placeholder="Váš Email" placeholderTextColor="#999" value={emailOrder} onChangeText={setEmailOrder} />
                      <View style={styles.catGrid}>{CATEGORIES.map(c => (<TouchableOpacity key={c} style={[styles.chip, selectedCats.includes(c) && styles.chipActive]} onPress={() => selectedCats.includes(c) ? setSelectedCats(selectedCats.filter(x => x !== c)) : setSelectedCats([...selectedCats, c])}><Text style={[styles.chipText, selectedCats.includes(c) && {color: '#000'}]}>{c}</Text></TouchableOpacity>))}</View>
                      <TouchableOpacity style={styles.goldBtn} onPress={handleSubmitOrder}><Text style={styles.goldBtnText}>PUBLIKOVAT</Text></TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.statsContainer}>
                   <View style={styles.statBox}><Text style={styles.statLabel}>Týden</Text><Text style={styles.statValue}>{visibleOrders.filter(o => (Date.now() - o.createdAt?.seconds*1000) < 604800000).length}</Text></View>
                   <View style={[styles.statBox, {borderLeftWidth:1, borderRightWidth:1, borderColor:'#444'}]}><Text style={styles.statLabel}>Měsíc</Text><Text style={styles.statValue}>{visibleOrders.filter(o => (Date.now() - o.createdAt?.seconds*1000) < 2592000000).length}</Text></View>
                   <View style={styles.statBox}><Text style={styles.statLabel}>Celkem</Text><Text style={styles.statValue}>{visibleOrders.length}</Text></View>
                </View>

                <View style={styles.listSection}>
                  <Text style={styles.sectionTitle}>Aktuální zakázky</Text>
                  {visibleOrders.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.orderCard} onPress={() => handleOpenOrder(item)}>
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderCats}>{item.categories[0]}</Text>
                        <View style={{flexDirection: 'row', gap: 10}}>
                          {item.status === 'PENDING' && <Text style={{color: '#FFA500', fontSize: 10, fontWeight: 'bold'}}>⏳ ČEKÁ</Text>}
                          <View style={styles.viewsBadge}><Ionicons name="eye-outline" size={14} color="#00BFFF" /><Text style={styles.viewsText}>{item.views || 0}</Text></View>
                        </View>
                      </View>
                      <Text style={styles.orderTitle}>{item.title}</Text><Text style={styles.orderPrice}>{item.price} Kč</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Footer />
              </>
            )}

            {view === 'AUTH' && (
              <ScrollView contentContainerStyle={{flexGrow: 1, width: '100%', alignItems: 'center', paddingTop: 40}}>
                <View style={styles.card}>
                  <Text style={styles.formTitle}>{authMode === 'LOGIN' ? 'Přihlášení' : 'Registrace'}</Text>
                  {authMode === 'REGISTER' && (
                      <View style={{flexDirection: 'row', gap: 10, marginVertical: 15}}>
                        <TouchableOpacity style={[styles.chip, registerRole === 'MASTER' && styles.chipActive, {flex:1, alignItems:'center'}]} onPress={() => setRegisterRole('MASTER')}><Text style={{color: registerRole === 'MASTER' ? '#000' : '#888'}}>Mistr</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.chip, registerRole === 'CLIENT' && styles.chipActive, {flex:1, alignItems:'center'}]} onPress={() => setRegisterRole('CLIENT')}><Text style={{color: registerRole === 'CLIENT' ? '#000' : '#888'}}>Zákazník</Text></TouchableOpacity>
                      </View>
                    )}
                  <TextInput style={[styles.input, {marginTop: 10}]} placeholder="Email" placeholderTextColor="#666" value={emailAuth} onChangeText={setEmailAuth} autoCapitalize="none" />
                  <TextInput style={styles.input} placeholder="Heslo" secureTextEntry placeholderTextColor="#666" value={passwordAuth} onChangeText={setPasswordAuth} />
                  {authMode === 'REGISTER' && registerRole === 'MASTER' && <TextInput style={styles.input} placeholder="IČO / SRO" placeholderTextColor="#666" value={regIco} onChangeText={setRegIco} />}
                  <TouchableOpacity style={styles.goldBtn} onPress={handleAuth}><Text style={styles.goldBtnText}>POKRAČOVAT</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} style={{marginTop: 20}}><Text style={{color: '#FFD700', textAlign: 'center'}}>Změnit на {authMode === 'LOGIN' ? 'Registraci' : 'Přihlášení'}</Text></TouchableOpacity>
                </View>
                <Footer />
              </ScrollView>
            )}

            {view === 'PROFILE' && (
               <View style={{paddingTop: 40, alignItems: 'center', width: '100%'}}>
                 <View style={styles.card}>
                    <Text style={styles.formTitle}>Můj profil</Text>
                    <Text style={styles.label}>Email:</Text><TextInput style={[styles.input, {color: '#888'}]} value={currentUser?.email || ''} editable={false} />
                    <Text style={styles.label}>Rok narození:</Text><TextInput style={styles.input} value={birthYear} onChangeText={setBirthYear} placeholder="1995" keyboardType="numeric" placeholderTextColor="#666" />
                    {userData?.role === 'MASTER' && <><Text style={styles.label}>IČO:</Text><TextInput style={styles.input} value={profileIco} onChangeText={setProfileIco} placeholder="Zadejte IČO" placeholderTextColor="#666" /></>}
                    <TouchableOpacity style={styles.goldBtn} onPress={handleSaveProfile}><Text style={styles.goldBtnText}>ULOŽIT ZMĚNY</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setView('FORM')} style={{marginTop: 20}}><Text style={{color: '#CCC', textAlign: 'center'}}>Zpět</Text></TouchableOpacity>
                 </View>
                 <Footer />
               </View>
            )}
          </ScrollView>

          <Modal visible={!!selectedOrder} animationType="slide" transparent>
            <View style={styles.modalOverlay}><View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}><Ionicons name="close" size={28} color="#FFD700" /></TouchableOpacity>
                {selectedOrder && (<ScrollView showsVerticalScrollIndicator={false}>
                    {selectedOrder.status === 'PENDING' && <Text style={{color: '#FFA500', fontWeight: 'bold', marginBottom: 10}}>⚠️ Tato zakázka čeká на schválení</Text>}
                    <Text style={styles.modalCats}>{selectedOrder.categories.join(' • ')}</Text>
                    <Text style={styles.modalTitle}>{selectedOrder.title}</Text>
                    <View style={styles.modalInfoRow}>
                       <View style={styles.infoBox}><Text style={styles.infoLabel}>ROZPOČET</Text><Text style={styles.infoValue}>{selectedOrder.price} Kč</Text></View>
                       <View style={styles.infoBox}><Text style={styles.infoLabel}>ZOBRAZENÍ</Text><Text style={styles.infoValue}>{selectedOrder.views}</Text></View>
                    </View>
                    <Text style={styles.infoLabel}>POPIS:</Text><Text style={styles.modalDesc}>{selectedOrder.description}</Text>
                    <Text style={styles.infoLabel}>KONTAKTNÍ EMAIL:</Text><Text style={styles.modalDesc}>{maskContact(selectedOrder.email || "neuvedeno", 'email')}</Text>
                    <TouchableOpacity style={[styles.callBtn, (!currentUser || !isProfileComplete()) && {backgroundColor: '#222'}]} onPress={() => { if(!currentUser) return setView('AUTH'); if(!isProfileComplete()) return setView('PROFILE'); Alert.alert("Kontakt", selectedOrder.phone); }}>
                      <Ionicons name="call" size={20} color={(currentUser && isProfileComplete()) ? "#000" : "#555"} />
                      <Text style={[styles.callBtnText, (!currentUser || !isProfileComplete()) && {color: '#555'}]}>{maskContact(selectedOrder.phone, 'phone')}</Text>
                    </TouchableOpacity>
                    
                    {currentUser?.email === ADMIN_EMAIL && (
                      <View style={{marginTop: 30, gap: 15}}>
                        {selectedOrder.status === 'PENDING' && (
                          <TouchableOpacity style={[styles.callBtn, {backgroundColor: '#00BFFF'}]} onPress={async()=>{await updateDoc(doc(db,"poptavky",selectedOrder.id), {status: 'APPROVED'}); setSelectedOrder(null);}}>
                            <Text style={styles.callBtnText}>Schválit zakázku</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={{padding: 15, borderWidth: 1, borderColor: '#FF4444', borderRadius: 15, alignItems: 'center'}} onPress={async()=>{await deleteDoc(doc(db,"poptavky",selectedOrder.id)); setSelectedOrder(null);}}>
                          <Text style={{color:'#FF4444', fontWeight:'bold'}}>Smazat</Text>
                        </TouchableOpacity>
                      </View>
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
  darkOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  header: { paddingTop: 60, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 },
  logo: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  profileBtn: { padding: 10, backgroundColor: 'rgba(20, 20, 20, 0.9)', borderRadius: 12, borderWidth: 1, borderColor: '#444' },
  badge: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF4444' },
  menuCloseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 101 },
  floatingMenu: { position: 'absolute', top: 60, right: 25, width: 250, backgroundColor: '#111', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#FFD700', zIndex: 102 },
  menuTitleText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  menuDivider: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIcon: { marginRight: 15 },
  menuText: { color: '#FFF', fontSize: 14 },
  warningText: { color: '#FFD700', fontSize: 10 },
  scrollContent: { paddingBottom: 60, alignItems: 'center' },
  emblemContainer: { marginVertical: 20, alignItems: 'center' },
  glowIcon: { textShadowColor: '#FFD700', textShadowRadius: 20 },
  card: { backgroundColor: 'rgba(15, 15, 20, 0.95)', width: '92%', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#333' },
  neonBlueBorder: { borderWidth: 1.5, borderColor: '#00BFFF' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  formBody: { marginTop: 15 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { padding: 10, borderRadius: 8, backgroundColor: '#222', borderWidth: 1, borderColor: '#444' },
  chipActive: { backgroundColor: '#FFD700' },
  chipText: { color: '#CCC', fontSize: 11, fontWeight: 'bold' },
  label: { color: '#888', marginBottom: 5, marginTop: 10, fontSize: 12 },
  input: { backgroundColor: '#111', color: '#FFF', borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  goldBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center' },
  goldBtnText: { color: '#000', fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', width: '92%', backgroundColor: 'rgba(15,15,20,0.9)', borderRadius: 20, padding: 15, marginTop: 20, borderWidth:1, borderColor:'#333' },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#888', fontSize: 11 },
  statValue: { color: '#00BFFF', fontSize: 20, fontWeight: 'bold' },
  listSection: { width: '92%', marginTop: 25 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  orderCard: { backgroundColor: 'rgba(15, 15, 20, 0.9)', borderRadius: 18, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderCats: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  viewsBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewsText: { color: '#00BFFF', fontSize: 12 },
  orderTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  orderPrice: { color: '#FFD700', fontSize: 14, marginVertical: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '85%' },
  closeBtn: { alignSelf: 'flex-end', padding: 5 },
  modalCats: { color: '#00BFFF', fontSize: 12 },
  modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginVertical: 10 },
  modalInfoRow: { flexDirection: 'row', gap: 15, marginVertical: 20 },
  infoBox: { flex: 1, backgroundColor: '#1A1A24', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  infoLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  infoValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalDesc: { color: '#CCC', fontSize: 16, lineHeight: 24, marginBottom: 20 },
  callBtn: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 15, gap: 10 },
  callBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  footerContainer: { marginTop: 40, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center' },
  footerDivider: { width: '40%', height: 1, backgroundColor: '#FFD700', marginBottom: 20 },
  footerText: { color: '#888', fontSize: 12, textAlign: 'center', lineHeight: 18 }
});