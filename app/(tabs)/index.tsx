import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ВИПРАВЛЕНИЙ ШЛЯХ ДО FIREBASE
// Спробуй '../firebaseConfig', а якщо не знайде - '../../firebaseConfig'
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

// Типізація для TypeScript (щоб не було помилок 'never')
interface Poptavka {
  id: string;
  title: string;
  description: string;
  contact: string;
  categories: string[];
  createdAt: any;
}

const CATEGORIES = [
  'Malíř', 'Zedník', 'Instalatér', 'Elektrikář', 'Hodinový manžel', 
  'Podlahář', 'Obkladač', 'Úklid', 'Zahrada', 'Stěhování', 
  'Odvoz odpadu', 'Stavba', 'Ostatní'
];

export default function App() {
  const [poptavky, setPoptavky] = useState<Poptavka[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Стан для мульти-вибору (масив рядків)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');

  // Слухаємо базу даних у реальному часі
  useEffect(() => {
    try {
      const q = query(collection(db, "poptavky"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Poptavka[];
        setPoptavky(data);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase connection error:", error);
    }
  }, []);

  // ФУНКЦІЯ ВИДАЛЕННЯ (ПРАЦЮЄ!)
  const handleDelete = async (id: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, "poptavky", id));
      } catch (e) {
        console.error("Delete error:", e);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Opravdu chcete smazat tuto poptávku?")) {
        await performDelete();
      }
    } else {
      Alert.alert("Smazat", "Opravdu smazat?", [
        { text: "Zrušit" },
        { text: "Smazat", onPress: performDelete, style: "destructive" }
      ]);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(item => item !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0 || !title || !contact) {
      Alert.alert("Chyba", "Vyplňte kategorie, název a kontakt.");
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
      Alert.alert("Hotovo", "Odesláno!");
    } catch (e) {
      console.error("Submit error:", e);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* ВЕРХНЯ ЧАСТИНА (HEADER) */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>BYT<Text style={{color: '#FFD700'}}>NAKLÍČ</Text></Text>
            <Text style={styles.subLogo}>Servis rekonstrukce a oprav</Text>
          </View>
          <TouchableOpacity style={styles.adminToggle} onPress={() => setIsAdmin(!isAdmin)}>
            <Ionicons name={isAdmin ? "eye-off" : "settings-outline"} size={26} color="white" />
          </TouchableOpacity>
        </View>

        {/* ФОРМА (ДЛЯ КОРИСТУВАЧА) */}
        {!isAdmin && (
          <View style={styles.mainCard}>
            <View style={styles.cardDecoration} />
            <Text style={styles.cardTitle}>Nová poptávka</Text>
            
            <Text style={styles.label}>Vyberte profese (i více):</Text>
            <View style={styles.categoryContainer}>
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

            <TextInput style={styles.input} placeholder="Název (např. Rekonstrukce koupelny)" placeholderTextColor="#666" value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Popis práce..." placeholderTextColor="#666" multiline value={description} onChangeText={setDescription} />
            <TextInput style={styles.input} placeholder="Váš kontakt" placeholderTextColor="#666" value={contact} onChangeText={setContact} />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="black" /> : <Text style={styles.submitButtonText}>ODESLAT POPTÁVKU</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* СПИСОК ЗАЯВОК */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>{isAdmin ? "Administrace: Správa" : "Aktuální poptávky"}</Text>

          {poptavky.map((item) => (
            <View key={item.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={{flex: 1}}>
                  <View style={styles.tagRow}>
                    {item.categories?.map((c, idx) => (
                      <Text key={idx} style={styles.orderTag}>{c}</Text>
                    ))}
                  </View>
                  <Text style={styles.orderTitleText}>{item.title}</Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteIconButton}>
                    <Ionicons name="trash-outline" size={22} color="#FF4444" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.orderDescriptionText}>{item.description}</Text>
              <View style={styles.orderFooter}>
                <Ionicons name="call-outline" size={16} color="#FFD700" />
                <Text style={styles.contactText}>{item.contact}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ПОВНИЙ СПИСОК СТИЛІВ (300+ РЯДКІВ КОДУ ЗАГАЛОМ)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0A0A0A' },
  logoText: { fontSize: 26, fontWeight: '900', color: '#FFF' },
  subLogo: { color: '#555', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  adminToggle: { padding: 10, backgroundColor: '#151515', borderRadius: 14, borderWidth: 1, borderColor: '#222' },
  mainCard: { backgroundColor: '#0F0F0F', margin: 20, borderRadius: 28, padding: 25, borderWidth: 1, borderColor: '#1A1A1A' },
  cardDecoration: { height: 3, backgroundColor: '#FFD700', width: 60, borderRadius: 2, marginBottom: 15 },
  cardTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
  label: { color: '#888', fontSize: 13, marginBottom: 12, fontWeight: '600' },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  categoryChip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 14, backgroundColor: '#151515', borderWidth: 1, borderColor: '#222' },
  categoryChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  categoryChipText: { color: '#EEE', fontSize: 13 },
  categoryChipTextActive: { color: '#000', fontWeight: '800' },
  input: { backgroundColor: '#151515', color: '#FFF', borderRadius: 16, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#222', fontSize: 15 },
  textArea: { height: 110, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#FFD700', padding: 20, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  listSection: { paddingHorizontal: 20, marginTop: 10 },
  sectionHeader: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  orderCard: { backgroundColor: '#0F0F0F', borderRadius: 24, padding: 22, marginBottom: 18, borderWidth: 1, borderColor: '#1A1A1A', borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  orderTag: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(255,215,0,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  orderTitleText: { color: '#FFF', fontSize: 19, fontWeight: 'bold' },
  orderDescriptionText: { color: '#A0A0A0', fontSize: 14, marginTop: 12, lineHeight: 22 },
  orderFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1A1A1A', marginTop: 18, paddingTop: 15 },
  contactText: { color: '#FFF', marginLeft: 10, fontWeight: '600', fontSize: 15 },
  deleteIconButton: { padding: 8, backgroundColor: 'rgba(255, 68, 68, 0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,68,68,0.2)' }
});