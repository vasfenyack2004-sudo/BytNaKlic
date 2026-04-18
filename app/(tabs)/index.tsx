import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ПЕРЕВІРЕНИЙ ШЛЯХ ДО FIREBASE
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

export default function App() {
  // Стейт з типом 'any' для уникнення помилок на скріншотах
  const [poptavky, setPoptavky] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Стан для форми
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');

  // Повний список категорій
  const CATEGORIES = [
    'Malíř', 'Zedník', 'Instalatér', 'Elektrikář', 'Hodinový manžel', 
    'Podlahář', 'Obkladač', 'Úklid', 'Zahrada', 'Stěhování', 
    'Odvoz odpadu', 'Stavba', 'Ostatní'
  ];

  // Підключення до бази в реальному часі
  useEffect(() => {
    try {
      const q = query(collection(db, "poptavky"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPoptavky(data);
      }, (err) => {
        console.error("Firebase Snapshot error:", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase connection error:", e);
    }
  }, []);

  // Мульти-вибір категорій
  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(item => item !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  // Видалення заявки (Адмін)
  const handleDelete = async (id: string) => {
    const deleteAction = async () => {
      try {
        await deleteDoc(doc(db, "poptavky", id));
        if (Platform.OS === 'web') alert("Poptávka byla smazána.");
      } catch (e) {
        console.error("Delete error:", e);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Opravdu chcete smazat tuto poptávku?")) {
        await deleteAction();
      }
    } else {
      Alert.alert("Smazat", "Opravdu chcete smazat tuto poptávku?", [
        { text: "Zrušit", style: "cancel" },
        { text: "Smazat", onPress: deleteAction, style: "destructive" }
      ]);
    }
  };

  // Відправка форми
  const handleSubmit = async () => {
    if (selectedCategories.length === 0 || !title || !contact) {
      if (Platform.OS === 'web') alert("Vyplňte prosím všechna pole.");
      else Alert.alert("Chyba", "Vyplňte prosím všechna pole.");
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
        status: 'active'
      });
      setSelectedCategories([]);
      setTitle('');
      setDescription('');
      setContact('');
      if (Platform.OS === 'web') alert("Poptávka byla úspěšně odeslána!");
      else Alert.alert("Hotovo", "Poptávka byla úspěšně odeslána!");
    } catch (e) {
      console.error("AddDoc error:", e);
      alert("Došlo k chybě při odesílání.");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoMain}>BYT<Text style={styles.logoGold}>NAKLÍČ</Text></Text>
            <Text style={styles.logoSub}>SERVIS REKONSTRUKCE A OPRAV</Text>
          </View>
          <TouchableOpacity 
            style={styles.adminToggleBtn} 
            onPress={() => setIsAdmin(!isAdmin)}
          >
            <Ionicons 
              name={isAdmin ? "eye-off-outline" : "settings-outline"} 
              size={24} 
              color={isAdmin ? "#FFD700" : "white"} 
            />
          </TouchableOpacity>
        </View>

        {/* CONTENT SWITCHER */}
        {!isAdmin ? (
          <View style={styles.formContainer}>
            <View style={styles.formDecoration} />
            <Text style={styles.formTitle}>Nová poptávka</Text>
            
            <Text style={styles.inputLabel}>Vyberte profese (možno více):</Text>
            <View style={styles.catWrapper}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[
                    styles.catChip,
                    selectedCategories.includes(cat) && styles.catChipActive
                  ]}
                >
                  <Text style={[
                    styles.catChipText,
                    selectedCategories.includes(cat) && styles.catChipTextActive
                  ]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput 
              style={styles.inputField} 
              placeholder="Co potřebujete udělat?" 
              placeholderTextColor="#555"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput 
              style={[styles.inputField, styles.textAreaField]} 
              placeholder="Popište detaily zakázky..." 
              placeholderTextColor="#555"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />

            <TextInput 
              style={styles.inputField} 
              placeholder="Váš email nebo telefon" 
              placeholderTextColor="#555"
              value={contact}
              onChangeText={setContact}
            />

            <TouchableOpacity 
              style={[styles.mainSubmitBtn, loading && {opacity: 0.6}]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="black" />
              ) : (
                <Text style={styles.mainSubmitBtnText}>ODESLAT POPTÁVKU</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* ADMIN VIEW */
          <View style={styles.adminSection}>
            <Text style={styles.adminHeaderText}>Správa zakázek</Text>
            {poptavky.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="documents-outline" size={48} color="#222" />
                <Text style={styles.emptyStateText}>Zatím žádné poptávky</Text>
              </View>
            ) : (
              poptavky.map((item) => (
                <View key={item.id} style={styles.cardItem}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{flex: 1}}>
                      <View style={styles.cardTagsRow}>
                        {item.categories?.map((c: string, i: number) => (
                          <Text key={i} style={styles.cardTagText}>{c}</Text>
                        ))}
                      </View>
                      <Text style={styles.cardTitleText}>{item.title}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.cardDeleteBtn}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF4444" />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.cardDescText}>{item.description}</Text>
                  
                  <View style={styles.cardFooterRow}>
                    <Ionicons name="call-outline" size={14} color="#FFD700" />
                    <Text style={styles.cardContactText}>{item.contact}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ПОВНІ СТИЛІ (ПОВЕРНЕНО ВСІ ВІДСТУПИ ТА КОЛЬОРИ)
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  scrollContent: { 
    paddingBottom: 80 
  },
  header: { 
    paddingTop: 60, 
    paddingHorizontal: 25, 
    paddingBottom: 25, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: '#050505'
  },
  logoMain: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#FFF',
    letterSpacing: 1
  },
  logoGold: { 
    color: '#FFD700' 
  },
  logoSub: { 
    color: '#444', 
    fontSize: 10, 
    fontWeight: '800',
    marginTop: -2,
    textTransform: 'uppercase'
  },
  adminToggleBtn: { 
    padding: 12, 
    backgroundColor: '#111', 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222'
  },
  formContainer: { 
    backgroundColor: '#0A0A0A', 
    margin: 20, 
    borderRadius: 30, 
    padding: 25, 
    borderWidth: 1, 
    borderColor: '#151515',
    position: 'relative',
    overflow: 'hidden'
  },
  formDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 4,
    backgroundColor: '#FFD700'
  },
  formTitle: { 
    color: '#FFF', 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20 
  },
  inputLabel: { 
    color: '#666', 
    fontSize: 13, 
    marginBottom: 15,
    fontWeight: '600'
  },
  catWrapper: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginBottom: 25 
  },
  catChip: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 14, 
    backgroundColor: '#111', 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  catChipActive: { 
    backgroundColor: '#FFD700', 
    borderColor: '#FFD700' 
  },
  catChipText: { 
    color: '#888', 
    fontSize: 13 
  },
  catChipTextActive: { 
    color: '#000', 
    fontWeight: '900' 
  },
  inputField: { 
    backgroundColor: '#111', 
    color: '#FFF', 
    borderRadius: 18, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#1A1A1A',
    fontSize: 15
  },
  textAreaField: { 
    height: 120, 
    textAlignVertical: 'top' 
  },
  mainSubmitBtn: { 
    backgroundColor: '#FFD700', 
    padding: 22, 
    borderRadius: 20, 
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FFD700',
    shadowOpacity: 0.15,
    shadowRadius: 20
  },
  mainSubmitBtnText: { 
    color: '#000', 
    fontWeight: '900', 
    fontSize: 16,
    letterSpacing: 0.5
  },
  adminSection: { 
    paddingHorizontal: 20,
    marginTop: 10
  },
  adminHeaderText: { 
    color: '#FFF', 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 20,
    marginLeft: 5
  },
  cardItem: { 
    backgroundColor: '#0A0A0A', 
    borderRadius: 26, 
    padding: 22, 
    marginBottom: 18, 
    borderWidth: 1, 
    borderColor: '#151515',
    borderLeftWidth: 4, 
    borderLeftColor: '#FFD700' 
  },
  cardHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  cardTagsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginBottom: 8 
  },
  cardTagText: { 
    color: '#FFD700', 
    fontSize: 10, 
    fontWeight: 'bold', 
    textTransform: 'uppercase',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5
  },
  cardTitleText: { 
    color: '#FFF', 
    fontSize: 19, 
    fontWeight: 'bold' 
  },
  cardDescText: { 
    color: '#777', 
    fontSize: 14, 
    marginTop: 12, 
    lineHeight: 22 
  },
  cardFooterRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#1A1A1A', 
    marginTop: 20, 
    paddingTop: 15 
  },
  cardContactText: { 
    color: '#FFF', 
    marginLeft: 10, 
    fontWeight: '700',
    fontSize: 15
  },
  cardDeleteBtn: { 
    padding: 10, 
    backgroundColor: 'rgba(255, 68, 68, 0.05)', 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.1)'
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50
  },
  emptyStateText: {
    color: '#333',
    marginTop: 15,
    fontSize: 16
  }
});