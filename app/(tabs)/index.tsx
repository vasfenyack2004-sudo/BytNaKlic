import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc, getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

// Константи
const CATEGORIES = ["Vše", "Malíři", "Zedníci", "Instalatéři", "Elektrikáři", "Hodinový manžel", "Podlaháři", "Obkladači", "Úklid", "Zahrada"];
const BRICK_BG = { uri: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=2070&auto=format&fit=crop' };

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('home'); 
  const [isLoginView, setIsLoginView] = useState(true);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState(''); 
  const [ico, setIco] = useState(''); 

  // Data state
  const [orders, setOrders] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('Vše');

  // Form state
  const [task, setTask] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState(''); 
  const [clientEmail, setClientEmail] = useState('');
  const [selectedCat, setSelectedCat] = useState('Malíři');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserData(docSnap.data());
      }
      setLoading(false);
    });

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubscribeAuth(); unsubscribeOrders(); };
  }, []);

  // --- ФУНКЦІЇ КЕРУВАННЯ ---
  const handleAuth = async () => {
    if (!email || !password) { Alert.alert("Chyba", "Vyplňte e-mail a heslo"); return; }
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!businessName || !ico) { Alert.alert("Chyba", "Vyplňte firmu a IČO"); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), { businessName, ico, email, role: 'master' });
      }
      setScreen('home');
    } catch (e) { Alert.alert("Chyba", "Akce se nezdařila"); }
  };

  const handlePublish = async () => {
    if (!task || !location || !phone) { Alert.alert("Chyba", "Vyplňte povinná pole *"); return; }
    try {
      await addDoc(collection(db, "orders"), {
        jobDescription: task, city: location, phone, budget: budget || "Dohodou", 
        email: clientEmail, category: selectedCat, status: 'Aktivní', createdAt: new Date().toISOString()
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTask(''); setLocation(''); setPhone(''); setBudget(''); setClientEmail('');
      setScreen('home');
    } catch (e) { Alert.alert("Chyba", "Nepodařilo se odeslat"); }
  };

  const deleteOrder = (id: string) => {
    Alert.alert("Smazat?", "Opravdu chcete zakázku odstranit?", [
      { text: "Zrušit", style: "cancel" },
      { text: "Smazat", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "orders", id));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
    ]);
  };

  const updateStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Aktivní' ? 'V řešení' : 'Hotovo';
    await updateDoc(doc(db, "orders", id), { status: nextStatus });
    Haptics.selectionAsync();
  };

  const maskValue = (val: string, type: 'phone' | 'email') => {
    if (user || !val) return val || "Neuvedeno";
    if (type === 'phone') return val.substring(0, 3) + " *** ***";
    const parts = val.split('@');
    return parts[0].substring(0, 1) + "***@" + (parts[1] || "...");
  };

  const renderLayout = (children: React.ReactNode) => (
    <ImageBackground source={BRICK_BG} style={styles.container} imageStyle={{ opacity: 0.5 }}>
      <View style={styles.overlay}>{children}</View>
    </ImageBackground>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FF8C00" /></View>;

  // --- ЕКРАН АДМІНКИ ---
  if (screen === 'admin') return renderLayout(
    <SafeAreaView style={{flex: 1}}>
      <View style={styles.header}>
        <Text style={styles.logoText}>MOJE <Text style={{color: '#FF8C00'}}>FIRMA</Text></Text>
        <TouchableOpacity onPress={() => { signOut(auth); setScreen('home'); }}>
          <Ionicons name="log-out-outline" size={28} color="#FF4444" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{padding: 20}}>
        <View style={styles.orderCard}>
            <Text style={styles.catLabel}>MISTR</Text>
            <Text style={styles.orderTitle}>{userData?.businessName}</Text>
            <Text style={styles.locationText}>IČO: {userData?.ico}</Text>
        </View>
        <Text style={styles.sectionTitle}>Správa vašich zakázek:</Text>
        {orders.map(item => (
          <View key={item.id} style={[styles.orderCard, {borderColor: item.status === 'Hotovo' ? '#4CAF50' : '#FF8C00'}]}>
            <View style={styles.cardHeader}>
              <Text style={styles.catLabel}>{item.category} | {item.status || 'Aktivní'}</Text>
              <TouchableOpacity onPress={() => deleteOrder(item.id)}>
                <Ionicons name="trash-outline" size={22} color="#FF4444" />
              </TouchableOpacity>
            </View>
            <Text style={styles.orderTitle}>{item.jobDescription}</Text>
            <Text style={styles.locationText}>📍 {item.city}</Text>
            <View style={styles.adminActions}>
                <TouchableOpacity style={styles.callBtnSmall} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                    <Text style={styles.btnTextWhite}>📞 Volat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statusBtnSmall} onPress={() => updateStatus(item.id, item.status)}>
                    <Text style={styles.btnTextWhite}>⚙️ Stav</Text>
                </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.backBtnFull} onPress={() => setScreen('home')}><Text style={styles.mainActionBtnText}>ZPĚT</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // --- ЕКРАН АВТОРИЗАЦІЇ ---
  if (screen === 'auth') return renderLayout(
    <SafeAreaView style={{flex: 1}}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.formPadding}>
          <Text style={styles.formTitle}>{isLoginView ? "Přihlášení" : "Registrace"}</Text>
          {!isLoginView && (
            <>
              <TextInput style={styles.darkInput} placeholder="Název firmy / SRO *" placeholderTextColor="#888" value={businessName} onChangeText={setBusinessName} />
              <TextInput style={styles.darkInput} placeholder="IČO *" placeholderTextColor="#888" value={ico} onChangeText={setIco} keyboardType="numeric" />
            </>
          )}
          <TextInput style={styles.darkInput} placeholder="E-mail *" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.darkInput} placeholder="Heslo *" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
          <TouchableOpacity style={styles.mainActionBtn} onPress={handleAuth}><Text style={styles.mainActionBtnText}>VSTOUPIT</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setIsLoginView(!isLoginView)}>
            <Text style={styles.toggleText}>{isLoginView ? "Vytvořit účet firmy" : "Už mám účet"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('home')}><Text style={styles.backBtnSmall}>Zrušit</Text></TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // --- ЕКРАН ЗАМОВЛЕННЯ ---
  if (screen === 'order') return renderLayout(
    <SafeAreaView style={{flex: 1}}>
      <ScrollView contentContainerStyle={styles.formPadding}>
        <Text style={styles.formTitle}>Nová poptávka</Text>
        <Text style={styles.inputLabel}>Vyberte kategorii *</Text>
        <View style={styles.catPickerGrid}>
          {CATEGORIES.filter(c => c !== "Vše").map(cat => (
            <TouchableOpacity key={cat} style={[styles.miniCatBtn, selectedCat === cat && styles.miniCatBtnActive]} onPress={() => setSelectedCat(cat)}>
              <Text style={[styles.miniCatText, selectedCat === cat && styles.miniCatTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.darkInput} placeholder="Co potřebujete udělat? *" placeholderTextColor="#888" value={task} onChangeText={setTask} />
        <TextInput style={styles.darkInput} placeholder="Město *" placeholderTextColor="#888" value={location} onChangeText={setLocation} />
        <TextInput style={styles.darkInput} placeholder="Telefon *" placeholderTextColor="#888" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.darkInput} placeholder="Rozpočet (Kč)" placeholderTextColor="#888" value={budget} onChangeText={setBudget} />
        <TextInput style={styles.darkInput} placeholder="E-mail (nepovinné)" placeholderTextColor="#888" value={clientEmail} onChangeText={setClientEmail} />
        <TouchableOpacity style={styles.mainActionBtn} onPress={handlePublish}><Text style={styles.mainActionBtnText}>ODESLAT</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('home')}><Text style={styles.backBtnSmall}>Zpět</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // --- ГОЛОВНИЙ ЕКРАН ---
  return renderLayout(
    <SafeAreaView style={{flex: 1}}>
      <View style={styles.header}>
        <Text style={styles.logoText}>BYT<Text style={{color: '#FF8C00'}}>NAKLÍČ</Text></Text>
        <TouchableOpacity onPress={() => setScreen(user ? 'admin' : 'auth')} style={styles.userBadge}>
             <Ionicons name="person" size={20} color={user ? "#FF8C00" : "#fff"} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight: 55, paddingLeft: 20}}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} style={[styles.catChip, activeCategory === cat && styles.catChipActive]} onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
      <ScrollView style={{padding: 20}}>
          <TouchableOpacity style={styles.mainActionBtn} onPress={() => setScreen('order')}><Text style={styles.mainActionBtnText}>+ ZADAT POPTÁVKU</Text></TouchableOpacity>
          <Text style={styles.sectionTitle}>Aktuální poptávky</Text>
          {orders.filter(o => activeCategory === "Vše" || o.category === activeCategory).map(item => (
            <View key={item.id} style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.catLabel}>{item.category} | {item.status || 'Aktivní'}</Text>
                <Text style={styles.budgetText}>{item.budget} Kč</Text>
              </View>
              <Text style={styles.orderTitle}>{item.jobDescription}</Text>
              <Text style={styles.locationText}>📍 {item.city}</Text>
              <View style={styles.divider} />
              <Text style={styles.maskedValue}>📞 {maskValue(item.phone, 'phone')}</Text>
              {item.email ? <Text style={styles.maskedValue}>✉️ {maskValue(item.email, 'email')}</Text> : null}
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  logoText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  userBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  catChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 25, marginRight: 10 },
  catChipActive: { backgroundColor: '#FF8C00' },
  catChipText: { color: '#aaa', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginVertical: 15 },
  orderCard: { backgroundColor: 'rgba(30,30,30,0.9)', padding: 18, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  catLabel: { color: '#FF8C00', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  budgetText: { color: '#4FC3F7', fontWeight: 'bold' },
  orderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  locationText: { color: '#888', marginTop: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
  maskedValue: { color: '#ddd', fontSize: 15, marginBottom: 4 },
  formPadding: { padding: 25, paddingTop: 40 },
  formTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 25 },
  inputLabel: { fontSize: 16, fontWeight: '700', color: '#ccc', marginBottom: 15 },
  darkInput: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 18, borderRadius: 15, marginBottom: 15, color: '#fff' },
  catPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  miniCatBtn: { padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, marginRight: 8, marginBottom: 8 },
  miniCatBtnActive: { backgroundColor: 'rgba(255,140,0,0.2)', borderColor: '#FF8C00' },
  miniCatText: { fontSize: 12, color: '#aaa' },
  miniCatTextActive: { color: '#FF8C00', fontWeight: 'bold' },
  mainActionBtn: { backgroundColor: '#FF8C00', height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  mainActionBtnText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  toggleText: { textAlign: 'center', color: '#FF8C00', marginTop: 25, fontWeight: '700' },
  backBtnSmall: { textAlign: 'center', marginTop: 20, color: '#555' },
  adminActions: { flexDirection: 'row', marginTop: 15, justifyContent: 'space-between' },
  callBtnSmall: { backgroundColor: '#007AFF', flex: 0.48, padding: 12, borderRadius: 10, alignItems: 'center' },
  statusBtnSmall: { backgroundColor: '#444', flex: 0.48, padding: 12, borderRadius: 10, alignItems: 'center' },
  btnTextWhite: { color: '#fff', fontWeight: 'bold' },
  backBtnFull: { marginTop: 20, backgroundColor: '#333', padding: 18, borderRadius: 15, alignItems: 'center' }
});