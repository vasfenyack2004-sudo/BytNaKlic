import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Шлях до твого Firebase
import { auth, db } from '../../firebaseConfig';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc
} from 'firebase/firestore';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';

import { Ionicons } from '@expo/vector-icons';

// Типізація
interface Poptavka {
  id: string;
  title: string;
  description: string;
  price: string;
  phone: string;
  email?: string;
  categories: string[];
  createdAt: any;
}

export default function App() {
  const [view, setView] = useState<'FORM' | 'AUTH' | 'ADMIN'>('FORM');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'MASTER' | 'CLIENT' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Poptavka[]>([]);
  
  // Поля авторизації / Реєстрації
  const [emailAuth, setEmailAuth] = useState('');
  const [passwordAuth, setPasswordAuth] = useState('');
  const [registerRole, setRegisterRole] = useState<'MASTER' | 'CLIENT'>('MASTER');
  const [ico, setIco] = useState('');

  // Поля форми замовлення
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [emailClient, setEmailClient] = useState('');

  const CATEGORIES = [
    'ZEDNÍK', 'MALÍŘ', 'STAVEBNÍK', 'ELEKTRIKÁŘ', 'INSTALATÉR', 
    'PODLAHÁŘ', 'ÚKLID', 'ZAHRADA', 'STĚHOVÁNÍ'
  ];

  // Слухач стану юзера та замовлень
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Отримуємо роль користувача з бази
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            setUserRole(role);
            if (role === 'MASTER') setView('ADMIN');
            else setView('FORM'); // Клієнтів кидаємо назад на форму
          } else {
            setView('FORM');
          }
        } catch (e) {
          console.log("Error fetching user role", e);
        }
      } else {
        setUserRole(null);
      }
    });

    const q = query(collection(db, "poptavky"), orderBy("createdAt", "desc"));
    const unsubDocs = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Poptavka[];
      setOrders(data);
    });

    return () => { unsubAuth(); unsubDocs(); };
  }, []);

  // БЕЗДОГАННА РЕЄСТРАЦІЯ
  const handleRegister = async () => {
    if (!emailAuth || !passwordAuth) return Alert.alert("Chyba", "Vyplňte email a heslo");
    
    // Перевірка IČO для майстрів
    if (registerRole === 'MASTER' && !ico.trim()) {
      return Alert.alert("Chyba", "Jako Mistr musíte zadat své IČO nebo SRO.");
    }

    setLoading(true);
    try {
      // 1. Створюємо юзера в Auth
      const userCred = await createUserWithEmailAndPassword(auth, emailAuth, passwordAuth);
      
      // 2. Записуємо його дані в Firestore (Колекція 'users')
      await setDoc(doc(db, "users", userCred.user.uid), {
        email: emailAuth,
        role: registerRole,
        ico: ico.trim() || "neposkytnuto",
        createdAt: new Date()
      });

      Alert.alert("Úspěch", "Účet byl úspěšně vytvořen!");
      setEmailAuth(''); setPasswordAuth(''); setIco('');
    } catch (e: any) {
      Alert.alert("Chyba", "Registrace selhala: " + e.message);
    } finally { setLoading(false); }
  };

  // Вхід
  const handleLogin = async () => {
    if (!emailAuth || !passwordAuth) return Alert.alert("Chyba", "Vyplňte všechna pole");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, emailAuth, passwordAuth);
    } catch (e: any) {
      Alert.alert("Chyba", "Nesprávný email nebo heslo.");
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('FORM');
    setIsMenuOpen(false);
  };

  // Відправка замовлення
  const handleSubmit = async () => {
    if (!title || !phone || selectedCats.length === 0) {
      Alert.alert("Pozor", "Vyplňte prosím název, telefon a kategorii");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "poptavky"), {
        title,
        description: desc,
        price,
        phone,
        email: emailClient || "neuvedeno",
        categories: selectedCats,
        createdAt: new Date()
      });
      setTitle(''); setDesc(''); setPrice(''); setPhone(''); setEmailClient(''); setSelectedCats([]);
      Alert.alert("Úspěch", "Poptávka byla úspěšně odeslána");
    } catch (e) {
      Alert.alert("Chyba", "Nepodařilo se odeslat.");
    } finally { setLoading(false); }
  };

  const deleteOrder = async (id: string) => {
    try { await deleteDoc(doc(db, "poptavky", id)); } catch (e) { console.log(e); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ПРЕМІУМ ШАПКА */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>BYT<Text style={{color: '#FFD700'}}>NAKLÍČ</Text></Text>
          <Text style={styles.subLogo}>PREMIUM SERVIS</Text>
        </View>
        
        <View style={{zIndex: 100}}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => setIsMenuOpen(!isMenuOpen)}>
            <Ionicons name="person-outline" size={22} color="#FFD700" />
          </TouchableOpacity>

          {/* ПЛАВАЮЧЕ МЕНЮ */}
          {isMenuOpen && (
            <View style={styles.floatingMenu}>
              <View style={styles.menuHeader}>
                <Ionicons name="person-circle-outline" size={40} color="#FFD700" />
                <Text style={styles.menuTitleText}>{currentUser ? currentUser.email : "МЕНЮ КОРИСТУВАЧА"}</Text>
                {userRole && <Text style={{color: '#888', fontSize: 10, marginTop: 2}}>{userRole === 'MASTER' ? 'Role: Mistr' : 'Role: Zákazník'}</Text>}
              </View>
              <View style={styles.menuDivider} />
              
              {!currentUser ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('AUTH'); setAuthMode('LOGIN'); setIsMenuOpen(false);}}>
                    <Ionicons name="log-in-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Přihlásit se</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('AUTH'); setAuthMode('REGISTER'); setIsMenuOpen(false);}}>
                    <Ionicons name="person-add-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Registrace</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {userRole === 'MASTER' && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => {setView('ADMIN'); setIsMenuOpen(false);}}>
                      <Ionicons name="list-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                      <Text style={styles.menuText}>Nástěnka zakázek</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('FORM'); setIsMenuOpen(false);}}>
                    <Ionicons name="create-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Nová poptávka</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Odhlásit se</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ФОРМА ЗАМОВЛЕННЯ */}
        {view === 'FORM' && (
          <View style={styles.card}>
            <View style={styles.emblemContainer}>
              <Ionicons name="compass-outline" size={45} color="#FFD700" style={styles.emblemIcon} />
            </View>
            <Text style={styles.mainTitle}>Nová poptávka</Text>
            
            <Text style={styles.label}>Vyberte profese:</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity 
                  key={c} 
                  style={[styles.chip, selectedCats.includes(c) && styles.chipLuminous]}
                  onPress={() => selectedCats.includes(c) ? setSelectedCats(selectedCats.filter(x => x !== c)) : setSelectedCats([...selectedCats, c])}
                >
                  <Text style={[styles.chipText, selectedCats.includes(c) && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="Název zakázky" placeholderTextColor="#555" value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, {height: 80}]} placeholder="Popis práce..." placeholderTextColor="#555" multiline value={desc} onChangeText={setDesc} />
            <TextInput style={styles.input} placeholder="Cenová nabídka (Kč)" placeholderTextColor="#555" keyboardType="numeric" value={price} onChangeText={setPrice} />
            <TextInput style={styles.input} placeholder="Telefonní číslo" placeholderTextColor="#555" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <TextInput style={styles.input} placeholder="Email (nepovinné)" placeholderTextColor="#555" value={emailClient} onChangeText={setEmailClient} />

            <TouchableOpacity style={styles.goldBtnLuminous} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.goldBtnText}>ODESLAT ZÁVAZNĚ</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ЕКРАН АВТОРИЗАЦІЇ (ЛОГІН / РЕЄСТРАЦІЯ З ВИБОРОМ РОЛІ) */}
        {view === 'AUTH' && (
          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={[styles.mainTitle, {textAlign: 'center', marginBottom: 30}]}>
              {authMode === 'LOGIN' ? 'Vstup do účtu' : 'Vytvořit nový účet'}
            </Text>

            {/* ОРИГІНАЛЬНИЙ ПЕРЕМИКАЧ РОЛЕЙ (Тільки при реєстрації) */}
            {authMode === 'REGISTER' && (
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[styles.roleCard, registerRole === 'MASTER' && styles.roleCardActive]} 
                  onPress={() => setRegisterRole('MASTER')}
                >
                  <Ionicons name="hammer-outline" size={28} color={registerRole === 'MASTER' ? '#000' : '#FFD700'} />
                  <Text style={[styles.roleText, registerRole === 'MASTER' && {color: '#000'}]}>Jsem Mistr</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.roleCard, registerRole === 'CLIENT' && styles.roleCardActive]} 
                  onPress={() => setRegisterRole('CLIENT')}
                >
                  <Ionicons name="home-outline" size={28} color={registerRole === 'CLIENT' ? '#000' : '#FFD700'} />
                  <Text style={[styles.roleText, registerRole === 'CLIENT' && {color: '#000'}]}>Zákazník</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#555" value={emailAuth} onChangeText={setEmailAuth} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Heslo" placeholderTextColor="#555" secureTextEntry value={passwordAuth} onChangeText={setPasswordAuth} />

            {/* ДИНАМІЧНЕ ПОЛЕ IČO */}
            {authMode === 'REGISTER' && (
              <TextInput 
                style={styles.input} 
                placeholder={registerRole === 'MASTER' ? "IČO / SRO (Povinné pro mistry)" : "IČO (Nepovinné pro zákazníky)"} 
                placeholderTextColor={registerRole === 'MASTER' ? "#886A00" : "#555"} 
                value={ico} 
                onChangeText={setIco} 
                keyboardType="numeric"
              />
            )}

            <TouchableOpacity 
              style={styles.goldBtnLuminous} 
              onPress={authMode === 'LOGIN' ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.goldBtnText}>
                {authMode === 'LOGIN' ? 'PŘIHLÁSIT SE' : 'ZAREGISTROVAT SE'}
              </Text>}
            </TouchableOpacity>

            <View style={styles.authToggleBox}>
              <Text style={{color: '#666'}}>
                {authMode === 'LOGIN' ? 'Nemáte ještě účet?' : 'Již máte účet?'}
              </Text>
              <TouchableOpacity onPress={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}>
                <Text style={{color: '#FFD700', fontWeight: 'bold', marginLeft: 5}}>
                  {authMode === 'LOGIN' ? 'Zaregistrujte se' : 'Přihlaste se'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* АДМІН ПАНЕЛЬ (ТІЛЬКИ ДЛЯ МАЙСТРІВ) */}
        {view === 'ADMIN' && currentUser && userRole === 'MASTER' && (
          <View style={styles.adminContent}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
              <Text style={styles.mainTitle}>Nástěnka zakázek</Text>
              <Text style={{color: '#FFD700', fontWeight: 'bold'}}>{orders.length} aktivních</Text>
            </View>
            
            {orders.map((item) => (
              <View key={item.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderCatsLuminous}>{item.categories?.join(' • ')}</Text>
                  <TouchableOpacity onPress={() => deleteOrder(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.orderTitle}>{item.title}</Text>
                <Text style={styles.orderPrice}>Rozpočet: {item.price} Kč</Text>
                <Text style={styles.orderDesc}>{item.description}</Text>
                <Text style={{color: '#666', fontSize: 12, marginBottom: 15}}>Email: {item.email}</Text>
                
                <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert("Kontakt", item.phone)}>
                  <Ionicons name="call" size={16} color="#000" />
                  <Text style={styles.callBtnText}>ZAVOLAT KLIENTA: {item.phone}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// === СТИЛІ ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  scrollContent: { paddingBottom: 80, alignItems: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  subLogo: { color: '#888', fontSize: 10, fontWeight: 'bold', marginTop: -2, letterSpacing: 2 },
  profileBtn: { padding: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  floatingMenu: { position: 'absolute', top: 50, right: 0, width: 220, backgroundColor: '#121212', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#333', zIndex: 1000 },
  menuHeader: { alignItems: 'center', marginBottom: 10 },
  menuTitleText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
  menuDivider: { height: 1, backgroundColor: '#333', marginBottom: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIcon: { marginRight: 15 },
  menuText: { color: '#CCC', fontSize: 14 },
  card: { backgroundColor: '#121212', width: '92%', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#222', marginTop: 10 },
  emblemContainer: { alignItems: 'center', marginBottom: 10 },
  emblemIcon: { textShadowColor: 'rgba(255, 215, 0, 0.6)', textShadowRadius: 15 },
  mainTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
  
  // КАРТКИ ВИБОРУ РОЛІ
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  roleCard: { flex: 1, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 20, alignItems: 'center', justifyContent: 'center' },
  roleCardActive: { backgroundColor: '#FFD700', borderColor: '#FFD700', shadowColor: '#FFD700', shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.5, shadowRadius: 10 },
  roleText: { color: '#FFF', fontWeight: 'bold', marginTop: 10, fontSize: 14 },
  authToggleBox: { flexDirection: 'row', justifyContent: 'center', marginTop: 25 },

  label: { color: '#666', fontSize: 12, marginBottom: 10 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  chipLuminous: { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.05)' },
  chipText: { color: '#666', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#FFD700' },
  input: { backgroundColor: '#1A1A1A', color: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  goldBtnLuminous: { backgroundColor: '#FFD700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  goldBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
  bottomLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  bottomLinkText: { color: '#FFF', fontWeight: 'bold', marginRight: 5 },
  
  adminContent: { width: '92%', marginTop: 20 },
  orderCard: { backgroundColor: '#121212', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  orderCatsLuminous: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  orderTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  orderPrice: { color: '#FFD700', fontSize: 14, marginVertical: 5, fontWeight: '600' },
  orderDesc: { color: '#888', fontSize: 13, marginBottom: 10 },
  callBtn: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 10, marginTop: 5 },
  callBtnText: { color: '#000', fontWeight: 'bold', marginLeft: 10 }
});