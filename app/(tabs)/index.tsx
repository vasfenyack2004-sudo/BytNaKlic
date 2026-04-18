import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

// ШЛЯХ ДО FIREBASE (Переконайся, що файл firebaseConfig.js в папці вище)
import { db } from '../../firebaseConfig';

import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

// Типізація для уникнення помилок 'never' як на твоїх скріншотах
interface Poptavka {
  id: string;
  title: string;
  description: string;
  contact: string;
  categories: string[];
  createdAt: any;
}

export default function App() {
  const [poptavky, setPoptavky] = useState<Poptavka[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);

  // Стан для авторизації
  const [adminPass, setAdminPass] = useState('');
  
  // Стан для форми
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');

  const CATEGORIES = [
    'Malíř', 'Zedník', 'Instalatér', 'Elektrikář', 'Hodinový manžel', 
    'Podlahář', 'Obkladač', 'Úklid', 'Zahrada', 'Stěhování', 
    'Odvoz odpadu', 'Stavba', 'Ostatní'
  ];

  // Завантаження даних у реальному часі
  useEffect(() => {
    const q = query(collection(db, "poptavky"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Poptavka[];
      setPoptavky(data);
    }, (error) => {
      console.error("Firebase error:", error);
    });
    return () => unsubscribe();
  }, []);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(item => item !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleLogin = () => {
    // Вхід в адмін-панель (можеш змінити пароль тут)
    if (adminPass === '1234' || adminPass === 'admin') {
      setIsAdmin(true);
      setIsLoggingIn(false);
      setAdminPass('');
    } else {
      Alert.alert("Chyba", "Nesprávné heslo для адмін панелі");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "poptavky", id));
      if (Platform.OS === 'web') alert("Smazáno!");
    } catch (e) {
      console.error("Error deleting:", e);
    }
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0 || !title || !contact) {
      alert("Vyplňte prosím všechna pole!");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "poptavky"), {
        categories: selectedCategories,
        title,
        description,
        contact,
        createdAt: new Date(),
      });
      setSelectedCategories([]);
      setTitle('');
      setDescription('');
      setContact('');
      alert("Poptávka odeslána успішно!");
    } catch (e) {
      console.error("Error adding:", e);
      alert("Došlo k chybě při odesílání.");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER З ЛОГОТИПОМ ТА КНОПКОЮ ВХОДУ */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>BYT<Text style={{color: '#FFD700'}}>NAKLÍČ</Text></Text>
            <Text style={styles.subLogo}>SERVIS REKONSTRUKCE A OPRAV</Text>
          </View>
          <TouchableOpacity 
            style={styles.loginBtnHeader} 
            onPress={() => isAdmin ? setIsAdmin(false) : setIsLoggingIn(true)}
          >
            <Ionicons name={isAdmin ? "log-out-outline" : "person-outline"} size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* ПАНЕЛЬ ВХОДУ (LOGIN MODAL) */}
        {isLoggingIn && (
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Přihlášení do správy</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Zadejte heslo" 
              placeholderTextColor="#666" 
              secureTextEntry 
              value={adminPass}
              onChangeText={setAdminPass}
            />
            <View style={styles.loginActions}>
              <TouchableOpacity onPress={() => setIsLoggingIn(false)} style={styles.cancelBtn}>
                <Text style={{color: '#888'}}>Zrušit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogin} style={styles.confirmLoginBtn}>
                <Text style={{color: '#000', fontWeight: 'bold'}}>Přihlásit se</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ГОЛОВНА ФОРМА (ЯКЩО НЕ АДМІН) */}
        {!isAdmin ? (
          <View style={styles.formContainer}>
            <View style={styles.accentLine} />
            <Text style={styles.formTitle}>Nová poptávka</Text>
            
            <Text style={styles.label}>Vyberte profese (i více):</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[styles.categoryChip, selectedCategories.includes(cat) && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, selectedCategories.includes(cat) && styles.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="Co potřebujete udělat?" placeholderTextColor="#555" value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Popis práce..." placeholderTextColor="#555" multiline value={description} onChangeText={setDescription} />
            <TextInput style={styles.input} placeholder="Váš telefon nebo email" placeholderTextColor="#555" value={contact} onChangeText={setContact} />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="black" /> : <Text style={styles.submitButtonText}>ODESLAT POPTÁVKU</Text>}
            </TouchableOpacity>

            <View style={styles.footerInfo}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#444" />
              <Text style={styles.footerInfoText}>Vaše údaje jsou u nás v bezpečí</Text>
            </View>
          </View>
        ) : (
          /* АДМІН ПАНЕЛЬ - СПИСОК ЗАМОВЛЕНЬ */
          <View style={styles.adminSection}>
            <Text style={styles.adminHeader}>Aktuální poptávky</Text>
            {poptavky.length === 0 && <Text style={{color: '#444', textAlign: 'center', marginTop: 40}}>Zatím žádné poptávky</Text>}
            {poptavky.map((item) => (
              <View key={item.id} style={styles.orderCard}>
                <View style={styles.orderHeaderRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.orderCategoryList}>{item.categories?.join(', ')}</Text>
                    <Text style={styles.orderTitleText}>{item.title}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteIconBtn}>
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.orderDescriptionText}>{item.description}</Text>
                <View style={styles.contactBox}>
                  <Ionicons name="call" size={14} color="#FFD700" />
                  <Text style={styles.contactText}>{item.contact}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { paddingBottom: 60 },
  header: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#050505' },
  logoText: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  subLogo: { color: '#444', fontSize: 10, fontWeight: 'bold', marginTop: -2 },
  loginBtnHeader: { padding: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  
  loginCard: { backgroundColor: '#111', margin: 20, padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  loginTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  loginActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, alignItems: 'center' },
  cancelBtn: { padding: 10 },
  confirmLoginBtn: { backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },

  formContainer: { backgroundColor: '#0A0A0A', margin: 20, borderRadius: 32, padding: 25, borderWidth: 1, borderColor: '#151515' },
  accentLine: { width: 40, height: 4, backgroundColor: '#FFD700', borderRadius: 2, marginBottom: 15 },
  formTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 25 },
  label: { color: '#666', fontSize: 13, marginBottom: 15, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  categoryChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  categoryChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  categoryChipText: { color: '#888', fontSize: 13 },
  categoryChipTextActive: { color: '#000', fontWeight: 'bold' },
  input: { backgroundColor: '#111', color: '#FFF', borderRadius: 18, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#1A1A1A', fontSize: 15 },
  textArea: { height: 120, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#FFD700', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10, shadowColor: '#FFD700', shadowOpacity: 0.2, shadowRadius: 15 },
  submitButtonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  footerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8 },
  footerInfoText: { color: '#444', fontSize: 12 },

  adminSection: { padding: 20 },
  adminHeader: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  orderCard: { backgroundColor: '#0A0A0A', borderRadius: 24, padding: 20, marginBottom: 18, borderWidth: 1, borderColor: '#151515', borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  orderHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  orderCategoryList: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  orderTitleText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  orderDescriptionText: { color: '#888', fontSize: 14, lineHeight: 20 },
  contactBox: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#1A1A1A', gap: 8 },
  contactText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  deleteIconBtn: { padding: 10, backgroundColor: 'rgba(255, 68, 68, 0.05)', borderRadius: 12 }
});