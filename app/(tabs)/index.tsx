import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
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

// РОЗУМНИЙ ІМПОРТ МАПИ ДЛЯ ВСІХ ПЛАТФОРМ
let MapView: any;
let Marker: any;

try {
  if (Platform.OS === 'web') {
    MapView = require('@teovilla/react-native-web-maps').default;
    Marker = require('@teovilla/react-native-web-maps').Marker;
  } else {
    MapView = require('react-native-maps').default;
    Marker = require('react-native-maps').Marker;
  }
} catch (e) {
  MapView = View;
  Marker = View;
}

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
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

// Пакет для сповіщень 
import emailjs from '@emailjs/browser';

emailjs.init("klUWyK6E3q0jVSWat"); 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) { 
  UIManager.setLayoutAnimationEnabledExperimental(true); 
} 

const ADMIN_EMAIL = 'vas.fenyack2004@gmail.com'; 

interface Poptavka { 
  id: string; 
  title: string; 
  description: string; 
  price: string; 
  phone: string; 
  email?: string; 
  address?: string; 
  categories: string[]; 
  createdAt: any; 
  views: number; 
  status: 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED'; 
  ownerId: string;
  workerId?: string;
  applicants?: any[]; 
  lat?: number; 
  lng?: number;
} 

export default function App() { 
  // Навігація та режими
  const [view, setView] = useState<'FORM' | 'AUTH' | 'PROFILE' | 'DASHBOARD'>('FORM'); 
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST'); 
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN'); 
  
  // Користувач
  const [currentUser, setCurrentUser] = useState<User | null>(null); 
  const [userData, setUserData] = useState<any>(null); 
  const [loading, setLoading] = useState(false); 
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [isFormExpanded, setIsFormExpanded] = useState(true); 
  
  // Замовлення
  const [orders, setOrders] = useState<Poptavka[]>([]); 
  const [selectedOrder, setSelectedOrder] = useState<Poptavka | null>(null); 
  
  // Авторизація
  const [emailAuth, setEmailAuth] = useState(''); 
  const [passwordAuth, setPasswordAuth] = useState(''); 
  const [registerRole, setRegisterRole] = useState<'MASTER' | 'CLIENT'>('MASTER'); 
  const [regIco, setRegIco] = useState(''); 
  const [agreedToTerms, setAgreedToTerms] = useState(false); // ГАЛОЧКА УМОВ
  
  // Профіль майстра
  const [profileIco, setProfileIco] = useState(''); 
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneProfile, setPhoneProfile] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [wantsPush, setWantsPush] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Форма створення замовлення
  const [selectedCats, setSelectedCats] = useState<string[]>([]); 
  const [title, setTitle] = useState(''); 
  const [desc, setDesc] = useState(''); 
  const [price, setPrice] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [emailOrder, setEmailOrder] = useState(''); 
  const [address, setAddress] = useState(''); 

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
            setFirstName(data.firstName || '');
            setLastName(data.lastName || '');
            setPhoneProfile(data.phone || '');
            setWantsPush(data.wantsPush || false);
            setSelectedSpecialties(data.specialties || []);
            
            if(data.dob) {
                const parts = data.dob.split('.');
                if(parts.length === 3) {
                    setDobDay(parts[0]); 
                    setDobMonth(parts[1]); 
                    setDobYear(parts[2]);
                }
            }
          } 
        }); 
        return () => unsubUser(); 
      } else { 
        setUserData(null); 
      } 
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
    
    const basicInfo = !!userData.firstName && !!userData.lastName && !!userData.dob && !!userData.phone;
    if (userData.role === 'MASTER') {
      return basicInfo && !!userData.ico && userData.ico !== '—' && userData.specialties?.length > 0; 
    }
    return basicInfo; 
  }; 

  const maskContact = (text: string, type: 'phone' | 'email') => { 
    if (currentUser?.email === ADMIN_EMAIL || isProfileComplete()) return text; 
    return type === 'phone' ? text.substring(0, 4) + " *** *** ***" : "***@***.cz"; 
  }; 

  const handleOpenOrder = async (order: Poptavka) => { 
    setSelectedOrder(order); 
    try { 
      await updateDoc(doc(db, "poptavky", order.id), { views: increment(1) }); 
    } catch(e){} 
  }; 

  const handleAuth = async () => { 
    if (!emailAuth || !passwordAuth) return Alert.alert("Chyba", "Vyplňte všechna pole."); 
    
    // ЮРИДИЧНА ПЕРЕВІРКА ПРИ РЕЄСТРАЦІЇ
    if (authMode === 'REGISTER') {
      if (registerRole === 'MASTER' && !regIco) return Alert.alert("Pozor", "IČO je povinné."); 
      if (!agreedToTerms) return Alert.alert("Upozornění", "Pro registraci musíte souhlasit s obchodními podmínkami platformy."); 
    }
    
    setLoading(true); 
    try { 
      if (authMode === 'REGISTER') { 
        const userCred = await createUserWithEmailAndPassword(auth, emailAuth, passwordAuth); 
        await setDoc(doc(db, "users", userCred.user.uid), { 
          email: emailAuth, 
          role: emailAuth === ADMIN_EMAIL ? 'SUPER_ADMIN' : registerRole, 
          ico: regIco || "—", 
          firstName: "", 
          lastName: "", 
          phone: "", 
          specialties: [], 
          rating: 5.0, 
          wantsPush: false, 
          dob: "", 
          createdAt: new Date() 
        }); 
        setView(emailAuth === ADMIN_EMAIL ? 'FORM' : 'PROFILE'); 
      } else { 
        await signInWithEmailAndPassword(auth, emailAuth, passwordAuth); 
        setView('FORM'); 
      } 
      setIsMenuOpen(false); 
      setAgreedToTerms(false); // Скидаємо галочку
    } catch (e) { 
      Alert.alert("Chyba", "Nepodařilo se přihlásit. Zkontrolujte údaje."); 
    } finally { 
      setLoading(false); 
    } 
  }; 

  const handleSaveProfile = async () => { 
    if (!firstName || !lastName || !dobDay || !dobMonth || !dobYear || !phoneProfile) {
        return Alert.alert("Pozor", "Vyplňte jméno, příjmení, telefon a datum narození."); 
    }
    
    setLoading(true); 
    try { 
      await setDoc(doc(db, "users", currentUser!.uid), { 
          ico: profileIco || "—", 
          firstName, 
          lastName, 
          phone: phoneProfile,
          specialties: selectedSpecialties,
          wantsPush,
          dob: `${dobDay}.${dobMonth}.${dobYear}` 
      }, { merge: true }); 
      
      Alert.alert("Úspěch", "Profil uložen."); 
      setView('FORM'); 
    } catch (e) { 
      Alert.alert("Chyba", "Data nebyla uložena."); 
    } finally { 
      setLoading(false); 
    } 
  }; 

  const handleSubmitOrder = async () => { 
    if (!title || !phone || !address || selectedCats.length === 0) return Alert.alert("Pozor", "Doplňte název, adresu, telefon a kategorii."); 
    
    setLoading(true); 
    const initialStatus = currentUser?.email === ADMIN_EMAIL ? 'APPROVED' : 'PENDING'; 
    
    let finalLat = 50.0755 + (Math.random() - 0.5) * 0.05;
    let finalLng = 14.4378 + (Math.random() - 0.5) * 0.05;

    try {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', CZ')}&key=AIzaSyB6jRajx--T5L8ru_r-PCNM-jQKTSi9zN4`);
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        finalLat = geoData.results[0].geometry.location.lat;
        finalLng = geoData.results[0].geometry.location.lng;
      }
    } catch (e) { 
      console.log('Geocoding failed'); 
    }

    try { 
      await addDoc(collection(db, "poptavky"), { 
        title, 
        description: desc, 
        price, 
        phone, 
        address, 
        email: emailOrder || "neuvedeno", 
        categories: selectedCats, 
        createdAt: new Date(), 
        views: 0, 
        status: initialStatus,
        ownerId: currentUser?.uid || 'guest',
        applicants: [],
        lat: finalLat, 
        lng: finalLng
      }); 

      if (initialStatus === 'PENDING') { 
        try { 
          await emailjs.send('service_9flz7xf', 'template_dsxyb8h', { 
            title: title, 
            phone: phone, 
            desc: desc || "Bez popisu", 
            email: emailOrder || "neuvedeno" 
          }, 'klUWyK6E3q0jVSWat'); 
        } catch (mailErr) { 
          console.error('MAIL FAIL', mailErr); 
        } 
      } 

      setTitle(''); setDesc(''); setPrice(''); setPhone(''); setEmailOrder(''); setAddress(''); setSelectedCats([]); 
      setIsFormExpanded(false); 
      Alert.alert("Hotovo", initialStatus === 'APPROVED' ? "Zakázka byla publikována." : "Odesláno ke schválení."); 

    } catch (e: any) { 
      Alert.alert("Chyba", "Nepodařilo se uložit zakázku."); 
    } finally { 
      setLoading(false); 
    } 
  }; 

  // --- ЛОГІКА ДЛЯ СУПЕР-СИСТЕМИ З ПІДТРИМКОЮ WEB ---
  const handleApplyForJob = async (orderId: string) => {
    if (!currentUser) {
      setView('AUTH');
      setSelectedOrder(null);
      return;
    }
    
    if (!isProfileComplete()) {
      Alert.alert("Profil", "Nejdříve vyplňte svůj profil (včetně specializace).");
      setView('PROFILE');
      setSelectedOrder(null);
      return;
    }
    
    const applyAction = async () => {
      const masterData = {
        uid: currentUser.uid,
        name: `${userData.firstName} ${userData.lastName}`,
        rating: userData.rating || 5.0
      };
      await updateDoc(doc(db, "poptavky", orderId), { 
        applicants: arrayUnion(masterData) 
      });
      setSelectedOrder(null);
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Zájem o práci\n\nNejdříve kontaktujte zákazníka telefonicky. Pokud jste se dohodli, potvrďte zájem v aplikaci. Chcete pokračovat?");
      if (confirmed) {
        await applyAction();
        window.alert("Váš zájem byl odeslán zákazníkovi. Sledujte záložku 'Moje aktivity'.");
      }
    } else {
      Alert.alert(
        "Zájem o práci",
        "Nejdříve kontaktujte zákazníka telefonicky. Pokud jste se dohodli, potvrďte zájem v aplikaci.",
        [
          { text: "Zrušit", style: "cancel" },
          { text: "Potvrdit zájem", onPress: async () => {
              await applyAction();
              Alert.alert("Odesláno", "Váš zájem byl odeslán zákazníkovi. Sledujte záložku 'Moje aktivity'.");
          }}
        ]
      );
    }
  };

  const handleCallClick = () => {
    if (!currentUser) { 
      if (Platform.OS === 'web') {
        const ok = window.confirm("Nutná registrace\n\nPro zobrazení kontaktu se musíte nejdříve přihlásit. Přejít na přihlášení?");
        if (ok) { setSelectedOrder(null); setView('AUTH'); }
      } else {
        Alert.alert("Nutná registrace", "Pro zobrazení kontaktu se musíte nejdříve přihlásit.", [
          { text: "Zavřít", style: "cancel" }, 
          { text: "Přihlásit se", onPress: () => { setSelectedOrder(null); setView('AUTH'); } }
        ]); 
      }
      return; 
    } 
    if (!isProfileComplete()) { 
      Alert.alert("Profil není kompletní", "Vyplňte celý profil pro zobrazení kontaktu."); 
      setView('PROFILE'); setSelectedOrder(null); 
      return; 
    } 
    
    if (selectedOrder?.phone) {
      const phoneNumber = selectedOrder.phone;
      if (Platform.OS === 'web') {
        window.open(`tel:${phoneNumber}`);
      } else {
        Linking.openURL(`tel:${phoneNumber}`);
      }
    }
  };

  const handleApproveWorker = async (orderId: string, workerId: string) => {
    await updateDoc(doc(db, "poptavky", orderId), { 
      status: 'IN_PROGRESS', 
      workerId: workerId 
    });
    Alert.alert("Schváleno", "Mistr byl úspěšně vybrán. Práce může začít!");
    setSelectedOrder(null);
  };

  const handleCompleteWork = async (orderId: string) => {
    await updateDoc(doc(db, "poptavky", orderId), { 
      status: 'COMPLETED' 
    });
    Alert.alert("Skvělá práce!", "Zakázka byla označena jako dokončená.");
    setSelectedOrder(null);
  };
  // ---------------------------------

  const formatDate = (dateObj: any) => {
    if (!dateObj || !dateObj.seconds) return 'Dnes';
    const d = new Date(dateObj.seconds * 1000);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  };

  // ОНОВЛЕНИЙ ФУТЕР З ПРАВАМИ ТА УМОВАМИ
  const Footer = () => ( 
    <View style={styles.footerContainer}> 
      <View style={styles.footerDivider} /> 
      <Text style={styles.footerText}> 
        © {new Date().getFullYear()} <Text style={{color: '#FFD700'}}>BytNaKlíč</Text>. Premium Servis v ČR. 
      </Text> 
      <Text style={styles.footerText}>Všechna práva vyhrazena.</Text> 
      
      <TouchableOpacity 
        style={{marginTop: 10}} 
        onPress={() => {
          const msg = "BytNaKlíč je inzertní platforma. Slouží výhradně k propojení poptávajících s mistry. Provozovatel platformy nenese žádnou právní ani finanční odpovědnost za kvalitu odvedené práce, dodržení termínů ani za finanční transakce mezi uživateli.";
          if (Platform.OS === 'web') {
            window.alert(msg);
          } else {
            Alert.alert("Vyloučení odpovědnosti", msg);
          }
        }}
      >
        <Text style={{color: '#666', fontSize: 11, textDecorationLine: 'underline', textAlign: 'center'}}>
          Obchodní podmínky a vyloučení odpovědnosti
        </Text>
      </TouchableOpacity>
    </View> 
  ); 

  const approvedOrders = orders.filter(o => o.status === 'APPROVED' || currentUser?.email === ADMIN_EMAIL);
  const visibleOrders = activeFilter ? approvedOrders.filter(o => o.categories.includes(activeFilter)) : approvedOrders;

  const myZakazky = orders.filter(o => o.ownerId === currentUser?.uid);
  const myPrace = orders.filter(o => o.workerId === currentUser?.uid || o.applicants?.some(a => a.uid === currentUser?.uid));

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDING': return { text: '⏳ ČEKÁ NA SCHVÁLENÍ', color: '#888888' };
      case 'APPROVED': return { text: '✅ HLEDÁ MISTRA', color: '#FFD700' };
      case 'IN_PROGRESS': return { text: '🛠 PROBÍHÁ', color: '#00BFFF' };
      case 'COMPLETED': return { text: '🎉 HOTOVO', color: '#32CD32' };
      default: return { text: status, color: '#FFFFFF' };
    }
  };

  return ( 
    <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2000&auto=format&fit=crop' }} style={styles.backgroundImage} imageStyle={{ opacity: 1 }}> 
      <View style={styles.darkOverlay}> 
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}> 
          <StatusBar barStyle="light-content" /> 
          
          {/* HEADER З КЛІКАБЕЛЬНИМ ЛОГОТИПОМ */}
          <View style={styles.header}> 
            <TouchableOpacity onPress={() => { setView('FORM'); setSelectedOrder(null); setIsMenuOpen(false); }}>
              <Text style={styles.logo}>BYT<Text style={{color: '#FFD700'}}>NAKLÍČ</Text></Text> 
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileBtn} onPress={() => setIsMenuOpen(true)}> 
              <Ionicons name="person-outline" size={20} color="#FFD700" /> 
              {currentUser && !isProfileComplete() && <View style={styles.badge} />} 
            </TouchableOpacity> 
          </View> 

          {isMenuOpen && <TouchableOpacity style={styles.menuCloseOverlay} activeOpacity={1} onPress={() => setIsMenuOpen(false)} />} 
          
          {isMenuOpen && ( 
            <View style={styles.floatingMenu}> 
              <Text style={styles.menuTitleText}>
                {userData?.firstName ? `${userData.firstName} ${userData.lastName}` : (currentUser ? currentUser.email : "UŽIVATEL")}
              </Text> 
              <View style={styles.menuDivider} /> 
              
              {currentUser ? ( 
                <> 
                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('PROFILE'); setIsMenuOpen(false);}}> 
                    <Ionicons name="person-outline" size={18} color="#FFD700" style={styles.menuIcon} /> 
                    <View>
                      <Text style={styles.menuText}>Můj profil</Text>
                      {!isProfileComplete() && <Text style={styles.warningText}>⚠️ Dokončit registraci</Text>}
                    </View> 
                  </TouchableOpacity> 

                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('DASHBOARD'); setIsMenuOpen(false);}}> 
                    <Ionicons name="briefcase-outline" size={18} color="#FFD700" style={styles.menuIcon} /> 
                    <Text style={styles.menuText}>Moje aktivity</Text>
                  </TouchableOpacity> 

                  <TouchableOpacity style={styles.menuItem} onPress={() => {setView('FORM'); setIsMenuOpen(false);}}>
                    <Ionicons name="list-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Nástěnka zakázek</Text>
                  </TouchableOpacity> 

                  <TouchableOpacity style={styles.menuItem} onPress={() => {signOut(auth); setIsMenuOpen(false); setView('FORM');}}>
                    <Ionicons name="log-out-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                    <Text style={styles.menuText}>Odhlásit se</Text>
                  </TouchableOpacity> 
                </> 
              ) : ( 
                <TouchableOpacity style={styles.menuItem} onPress={() => {setView('AUTH'); setIsMenuOpen(false);}}>
                  <Ionicons name="log-in-outline" size={18} color="#FFD700" style={styles.menuIcon} />
                  <Text style={styles.menuText}>Vstup pro mistry</Text>
                </TouchableOpacity> 
              )} 
              <TouchableOpacity style={[styles.menuItem, {marginTop: 10, borderTopWidth: 1, borderColor: '#333'}]} onPress={() => setIsMenuOpen(false)}>
                <Text style={{color: '#FFD700', width: '100%', textAlign: 'center', paddingTop: 10}}>Zavřít</Text>
              </TouchableOpacity> 
            </View> 
          )} 

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}> 
            
            {/* VIEW: FORM & MAIN LIST */}
            {view === 'FORM' && ( 
              <> 
                <View style={styles.emblemContainer}>
                  <Ionicons name="construct-outline" size={60} color="#FFD700" style={styles.glowIcon} />
                </View> 

                <View style={[styles.card, styles.neonBlueBorder]}> 
                  <TouchableOpacity style={styles.formHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsFormExpanded(!isFormExpanded); }}> 
                    <Text style={styles.formTitle}>Nová poptávka</Text> 
                    <Ionicons name={isFormExpanded ? "chevron-up" : "chevron-down"} size={24} color="#FFF" /> 
                  </TouchableOpacity> 

                  {isFormExpanded && ( 
                    <View style={styles.formBody}> 
                      <TextInput style={styles.input} placeholder="Název zakázky" placeholderTextColor="#999" value={title} onChangeText={setTitle} /> 
                      <TextInput style={styles.input} placeholder="Adresa (Ulice, Město)" placeholderTextColor="#999" value={address} onChangeText={setAddress} /> 
                      <TextInput style={[styles.input, {height: 80}]} placeholder="Detailní popis..." multiline placeholderTextColor="#999" value={desc} onChangeText={setDesc} /> 
                      <TextInput style={styles.input} placeholder="Rozpočet (Kč)" keyboardType="numeric" placeholderTextColor="#999" value={price} onChangeText={setPrice} /> 
                      <TextInput style={styles.input} placeholder="Telefon" keyboardType="phone-pad" placeholderTextColor="#999" value={phone} onChangeText={setPhone} /> 
                      <TextInput style={styles.input} placeholder="Váš Email" placeholderTextColor="#999" value={emailOrder} onChangeText={setEmailOrder} /> 
                      <View style={styles.catGrid}>
                        {CATEGORIES.map(c => (
                          <TouchableOpacity key={c} style={[styles.chip, selectedCats.includes(c) && styles.chipActive]} onPress={() => selectedCats.includes(c) ? setSelectedCats(selectedCats.filter(x => x !== c)) : setSelectedCats([...selectedCats, c])}>
                            <Text style={[styles.chipText, selectedCats.includes(c) && {color: '#000'}]}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View> 
                      <TouchableOpacity style={styles.goldBtn} onPress={handleSubmitOrder}>
                        <Text style={styles.goldBtnText}>PUBLIKOVAT</Text>
                      </TouchableOpacity> 
                    </View> 
                  )} 
                </View> 

                <View style={styles.statsContainer}> 
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Týden</Text>
                    <Text style={styles.statValue}>{approvedOrders.filter(o => (Date.now() - o.createdAt?.seconds*1000) < 604800000).length}</Text>
                  </View> 
                  <View style={[styles.statBox, {borderLeftWidth:1, borderRightWidth:1, borderColor:'#444'}]}>
                    <Text style={styles.statLabel}>Měsíc</Text>
                    <Text style={styles.statValue}>{approvedOrders.filter(o => (Date.now() - o.createdAt?.seconds*1000) < 2592000000).length}</Text>
                  </View> 
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Celkem</Text>
                    <Text style={styles.statValue}>{approvedOrders.length}</Text>
                  </View> 
                </View> 

                <View style={styles.listSection}> 
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Aktuální zakázky</Text>
                    <View style={styles.toggleContainer}>
                      <TouchableOpacity onPress={() => setViewMode('LIST')} style={[styles.toggleBtn, viewMode === 'LIST' && styles.toggleBtnActive]}>
                        <Ionicons name="list" size={14} color={viewMode === 'LIST' ? '#000' : '#888'} />
                        <Text style={[styles.toggleText, viewMode === 'LIST' && {color: '#000'}]}>Seznam</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setViewMode('MAP')} style={[styles.toggleBtn, viewMode === 'MAP' && styles.toggleBtnActive]}>
                        <Ionicons name="map" size={14} color={viewMode === 'MAP' ? '#000' : '#888'} />
                        <Text style={[styles.toggleText, viewMode === 'MAP' && {color: '#000'}]}>Mapa</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.filterWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                      <TouchableOpacity style={[styles.filterChip, !activeFilter && styles.filterChipActive]} onPress={() => setActiveFilter(null)}>
                        <Text style={[styles.filterChipText, !activeFilter && {color: '#000'}]}>Vše</Text>
                      </TouchableOpacity>
                      {CATEGORIES.map(c => (
                        <TouchableOpacity key={c} style={[styles.filterChip, activeFilter === c && styles.filterChipActive]} onPress={() => setActiveFilter(c)}>
                          <Text style={[styles.filterChipText, activeFilter === c && {color: '#000'}]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {viewMode === 'LIST' ? (
                    visibleOrders.length > 0 ? (
                      visibleOrders.map((item) => ( 
                        <TouchableOpacity key={item.id} style={styles.orderCard} onPress={() => handleOpenOrder(item)}> 
                          <View style={styles.orderHeader}> 
                            <Text style={styles.orderCats}>{item.categories[0]}</Text> 
                            <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}> 
                              <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
                              <View style={styles.viewsBadge}>
                                <Ionicons name="eye-outline" size={14} color="#00BFFF" />
                                <Text style={styles.viewsText}>{item.views || 0}</Text>
                              </View> 
                            </View> 
                          </View> 
                          <Text style={styles.orderTitle}>{item.title}</Text>
                          <Text style={styles.orderPrice}>{item.price} Kč</Text> 
                          {item.address && (
                            <Text style={{color: '#888888', fontSize: 11, marginTop: 5}}>
                              <Ionicons name="location-outline" size={12} color="#888888" /> {item.address}
                            </Text>
                          )}
                        </TouchableOpacity> 
                      ))
                    ) : (
                      <Text style={{color: '#888888', textAlign: 'center', marginTop: 20}}>Žádné zakázky pro tuto kategorii.</Text>
                    )
                  ) : (
                    <View style={styles.mapContainer}>
                        <MapView
                          style={styles.map}
                          provider="google"
                          googleMapsApiKey="AIzaSyB6jRajx--T5L8ru_r-PCNM-jQKTSi9zN4"
                          initialRegion={{
                            latitude: 50.0755,
                            longitude: 14.4378,
                            latitudeDelta: 0.1,
                            longitudeDelta: 0.1,
                          }}
                          customMapStyle={darkMapStyle}
                        >
                          {visibleOrders.map((order) => order.lat && (
                            <Marker
                              key={order.id}
                              coordinate={{ latitude: order.lat, longitude: order.lng! }}
                              onPress={() => handleOpenOrder(order)}
                              pinColor="#FFD700"
                            />
                          ))}
                        </MapView>
                    </View>
                  )}
                </View> 
                <Footer /> 
              </> 
            )} 

            {/* VIEW: DASHBOARD (MOJE AKTIVITY) */}
            {view === 'DASHBOARD' && (
              <View style={{width: '92%', paddingTop: 20}}>
                
                {/* БЛОК КЛІЄНТА */}
                {(!userData || userData.role === 'CLIENT' || currentUser?.email === ADMIN_EMAIL) && (
                  <View style={{marginBottom: 30}}>
                    <Text style={styles.dashboardMainTitle}>Moje poptávky</Text>
                    
                    {myZakazky.length === 0 ? (
                      <View style={styles.emptyStateContainer}>
                        <Ionicons name="document-text-outline" size={40} color="#444" />
                        <Text style={styles.emptyStateText}>Zatím jste nevytvořili žádnou zakázku.</Text>
                        <TouchableOpacity style={[styles.goldBtn, {marginTop: 15, paddingVertical: 12}]} onPress={() => setView('FORM')}>
                          <Text style={styles.goldBtnText}>Vytvořit poptávku</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      myZakazky.map(item => {
                        const badge = getStatusBadge(item.status);
                        const hasApplicants = item.status === 'APPROVED' && item.applicants && item.applicants.length > 0;
                        return (
                          <TouchableOpacity key={item.id} style={[styles.orderCard, hasApplicants ? {borderColor: '#FFD700', borderWidth: 2} : {}]} onPress={()=>setSelectedOrder(item)}>
                            <View style={styles.orderHeader}>
                              <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
                              <View style={[styles.statusBadge, {backgroundColor: badge.color + '20', borderColor: badge.color}]}>
                                <Text style={{color: badge.color, fontSize: 10, fontWeight: 'bold'}}>{badge.text}</Text>
                              </View>
                            </View>
                            <Text style={styles.orderTitle}>{item.title}</Text>
                            
                            {hasApplicants && (
                              <View style={styles.urgentActionBox}>
                                <Ionicons name="notifications" size={16} color="#000" />
                                <Text style={{color: '#000', fontSize: 12, fontWeight: 'bold'}}>
                                  Máte {item.applicants?.length} zájemců! Klikněte pro výběr.
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}

                {/* БЛОК МАЙСТРА */}
                {(!userData || userData.role === 'MASTER' || currentUser?.email === ADMIN_EMAIL) && (
                  <View>
                    <Text style={styles.dashboardMainTitle}>Moje projekty</Text>
                    
                    {myPrace.length === 0 ? (
                      <View style={styles.emptyStateContainer}>
                        <Ionicons name="hammer-outline" size={40} color="#444" />
                        <Text style={styles.emptyStateText}>Zatím nemáte žádné aktivní projekty.</Text>
                        <TouchableOpacity style={[styles.callBtn, {backgroundColor: '#222', marginTop: 15}]} onPress={() => setView('FORM')}>
                          <Text style={{color: '#FFFFFF'}}>Prohlédnout nabídky</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      myPrace.map(item => {
                        const isWorkingOnIt = item.workerId === currentUser?.uid;
                        const badgeColor = isWorkingOnIt ? '#00BFFF' : '#888888';
                        
                        return (
                          <TouchableOpacity key={item.id} style={[styles.orderCard, isWorkingOnIt ? {borderColor: '#00BFFF'} : {}]} onPress={()=>setSelectedOrder(item)}>
                            <View style={styles.orderHeader}>
                              <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
                              <View style={[styles.statusBadge, {backgroundColor: badgeColor + '20', borderColor: badgeColor}]}>
                                <Text style={{color: badgeColor, fontSize: 10, fontWeight: 'bold'}}>
                                  {isWorkingOnIt ? '🛠 PRACUJI NA TOM' : '⏳ ČEKÁM NA POTVRZENÍ'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.orderTitle}>{item.title}</Text>
                            {item.address && <Text style={{color: '#888888', fontSize: 11, marginTop: 5}}>📍 {item.address}</Text>}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}

                <Footer />
              </View>
            )}

            {/* VIEW: AUTH З ЮРИДИЧНОЮ ГАЛОЧКОЮ */}
            {view === 'AUTH' && ( 
              <ScrollView contentContainerStyle={{flexGrow: 1, width: '100%', alignItems: 'center', paddingTop: 40}}> 
                <View style={styles.card}> 
                  <Text style={styles.formTitle}>{authMode === 'LOGIN' ? 'Přihlášení' : 'Registrace'}</Text> 
                  
                  {authMode === 'REGISTER' && ( 
                    <View style={{flexDirection: 'row', gap: 10, marginVertical: 15}}> 
                      <TouchableOpacity style={[styles.chip, registerRole === 'MASTER' && styles.chipActive, {flex:1, alignItems:'center'}]} onPress={() => setRegisterRole('MASTER')}>
                        <Text style={{color: registerRole === 'MASTER' ? '#000' : '#888888'}}>Mistr</Text>
                      </TouchableOpacity> 
                      <TouchableOpacity style={[styles.chip, registerRole === 'CLIENT' && styles.chipActive, {flex:1, alignItems:'center'}]} onPress={() => setRegisterRole('CLIENT')}>
                        <Text style={{color: registerRole === 'CLIENT' ? '#000' : '#888888'}}>Zákazník</Text>
                      </TouchableOpacity> 
                    </View> 
                  )} 

                  <TextInput style={[styles.input, {marginTop: 10}]} placeholder="Email" placeholderTextColor="#666" value={emailAuth} onChangeText={setEmailAuth} autoCapitalize="none" /> 
                  <TextInput style={styles.input} placeholder="Heslo" secureTextEntry placeholderTextColor="#666" value={passwordAuth} onChangeText={setPasswordAuth} /> 
                  
                  {authMode === 'REGISTER' && registerRole === 'MASTER' && (
                    <TextInput style={styles.input} placeholder="IČO / SRO" placeholderTextColor="#666" value={regIco} onChangeText={setRegIco} />
                  )} 

                  {/* ГАЛОЧКА "УМОВИ ПЛАТФОРМИ" */}
                  {authMode === 'REGISTER' && (
                    <TouchableOpacity style={[styles.checkboxContainer, {marginTop: 5, marginBottom: 20}]} onPress={() => setAgreedToTerms(!agreedToTerms)}>
                      <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={22} color={agreedToTerms ? "#FFD700" : "#888"} />
                      <Text style={[styles.checkboxLabel, {fontSize: 11, flex: 1, color: '#888', lineHeight: 16}]}>
                        Souhlasím s obchodními podmínkami. Beru na vědomí, že platforma <Text style={{color: '#CCC'}}>nenese odpovědnost</Text> za kvalitu prací ani platební transakce.
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.goldBtn} onPress={handleAuth}>
                    <Text style={styles.goldBtnText}>POKRAČOVAT</Text>
                  </TouchableOpacity> 
                  <TouchableOpacity onPress={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} style={{marginTop: 20}}>
                    <Text style={{color: '#FFD700', textAlign: 'center'}}>Změnit na {authMode === 'LOGIN' ? 'Registraci' : 'Přihlášení'}</Text>
                  </TouchableOpacity> 
                </View> 
                <Footer /> 
              </ScrollView> 
            )} 

            {/* VIEW: PROFILE */}
            {view === 'PROFILE' && ( 
              <View style={{paddingTop: 40, alignItems: 'center', width: '100%'}}> 
                <View style={styles.card}> 
                  <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                    <Text style={styles.formTitle}>Můj profil</Text>
                    {userData?.role === 'MASTER' && (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.ratingText}>{(userData.rating || 5.0).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.label}>Email:</Text>
                  <TextInput style={[styles.input, {color: '#888888'}]} value={currentUser?.email || ''} editable={false} /> 

                  <Text style={styles.label}>Jméno:</Text>
                  <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Jan" placeholderTextColor="#666" />
                  
                  <Text style={styles.label}>Příjmení:</Text>
                  <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Novák" placeholderTextColor="#666" />

                  <Text style={styles.label}>Telefon (pro zákazníky):</Text>
                  <TextInput style={styles.input} value={phoneProfile} onChangeText={setPhoneProfile} placeholder="+420 ..." keyboardType="phone-pad" placeholderTextColor="#666" />

                  <Text style={styles.label}>Datum narození:</Text>
                  <View style={{flexDirection:'row', gap: 10}}>
                      <TextInput style={[styles.input, {flex:1}]} value={dobDay} onChangeText={setDobDay} placeholder="Den" keyboardType="numeric" maxLength={2} placeholderTextColor="#666" />
                      <TextInput style={[styles.input, {flex:1}]} value={dobMonth} onChangeText={setDobMonth} placeholder="Měsíc" keyboardType="numeric" maxLength={2} placeholderTextColor="#666" />
                      <TextInput style={[styles.input, {flex:1.5}]} value={dobYear} onChangeText={setDobYear} placeholder="Rok" keyboardType="numeric" maxLength={4} placeholderTextColor="#666" />
                  </View>

                  {userData?.role === 'MASTER' && (
                    <>
                      <Text style={styles.label}>IČO:</Text>
                      <TextInput style={styles.input} value={profileIco} onChangeText={setProfileIco} placeholder="Zadejte IČO" placeholderTextColor="#666" />
                      
                      <Text style={styles.label}>Moje specializace (vyberte i více):</Text>
                      <View style={styles.catGrid}>
                        {CATEGORIES.map(c => (
                          <TouchableOpacity key={c} style={[styles.chip, selectedSpecialties.includes(c) && styles.chipActive]} onPress={() => selectedSpecialties.includes(c) ? setSelectedSpecialties(selectedSpecialties.filter(x => x !== c)) : setSelectedSpecialties([...selectedSpecialties, c])}>
                            <Text style={[styles.chipText, selectedSpecialties.includes(c) && {color: '#000'}]}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={styles.checkboxContainer} onPress={() => setWantsPush(!wantsPush)}>
                        <Ionicons name={wantsPush ? "checkbox" : "square-outline"} size={24} color="#FFD700" />
                        <View>
                            <Text style={styles.checkboxLabel}>Dostávat upozornění na nové zakázky</Text>
                            <Text style={{color:'#FFA500', fontSize:10}}>⚠️ Tato funkce je zatím ve vývoji</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  )} 

                  <TouchableOpacity style={styles.goldBtn} onPress={handleSaveProfile}>
                    <Text style={styles.goldBtnText}>ULOŽIT ZMĚNY</Text>
                  </TouchableOpacity> 
                  <TouchableOpacity onPress={() => setView('FORM')} style={{marginTop: 20}}>
                    <Text style={{color: '#CCC', textAlign: 'center'}}>Zpět</Text>
                  </TouchableOpacity> 
                </View> 
                <Footer /> 
              </View> 
            )} 
          </ScrollView> 

          {/* MODAL ДЛЯ ДЕТАЛЕЙ ЗАМОВЛЕННЯ */}
          <Modal visible={!!selectedOrder} animationType="slide" transparent> 
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}> 
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="close" size={28} color="#FFD700" />
                </TouchableOpacity> 
                
                {selectedOrder && (
                  <ScrollView showsVerticalScrollIndicator={false}> 
                    {selectedOrder.status === 'PENDING' && (
                      <Text style={{color: '#FFA500', fontWeight: 'bold', marginBottom: 10}}>⚠️ Tato zakázka čeká na schválení adminem</Text>
                    )} 
                    
                    <Text style={styles.modalCats}>{selectedOrder.categories.join(' • ')}</Text> 
                    <Text style={styles.modalTitle}>{selectedOrder.title}</Text> 
                    
                    <View style={styles.modalInfoRow}> 
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>ROZPOČET</Text>
                        <Text style={styles.infoValue}>{selectedOrder.price} Kč</Text>
                      </View> 
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>STAV</Text>
                        <Text style={[styles.infoValue, {fontSize: 14, color: getStatusBadge(selectedOrder.status).color}]}>
                          {getStatusBadge(selectedOrder.status).text}
                        </Text>
                      </View> 
                    </View> 
                    
                    <Text style={styles.infoLabel}>POPIS:</Text>
                    <Text style={styles.modalDesc}>{selectedOrder.description}</Text> 
                    
                    {selectedOrder.address && (
                      <>
                        <Text style={styles.infoLabel}>LOKALITA:</Text>
                        <Text style={styles.modalDesc}>{selectedOrder.address}</Text>
                      </>
                    )}
                    
                    <Text style={styles.infoLabel}>KONTAKTNÍ EMAIL ZÁKAZNÍKA:</Text>
                    <Text style={styles.modalDesc}>{maskContact(selectedOrder.email || "neuvedeno", 'email')}</Text> 

                    {/* ДІЇ ДЛЯ МАЙСТРА (Не власник, статус APPROVED) */}
                    {selectedOrder.ownerId !== currentUser?.uid && selectedOrder.status === 'APPROVED' && (
                      <TouchableOpacity style={[styles.callBtn, {marginBottom: 15}]} onPress={() => handleApplyForJob(selectedOrder.id)}>
                        <Text style={styles.callBtnText}>Chci tuto práci</Text>
                      </TouchableOpacity>
                    )}

                    {/* ДІЇ ДЛЯ МАЙСТРА (Робота виконується ним) */}
                    {selectedOrder.status === 'IN_PROGRESS' && selectedOrder.workerId === currentUser?.uid && (
                      <TouchableOpacity style={[styles.callBtn, {backgroundColor: '#32CD32', marginBottom: 15}]} onPress={() => handleCompleteWork(selectedOrder.id)}>
                        <Text style={styles.callBtnText}>Označit práci jako dokončenou</Text>
                      </TouchableOpacity>
                    )}

                    {/* ДІЇ ДЛЯ ВЛАСНИКА ЗАМОВЛЕННЯ (Вибір майстра) */}
                    {selectedOrder.ownerId === currentUser?.uid && selectedOrder.status === 'APPROVED' && selectedOrder.applicants && selectedOrder.applicants.length > 0 && (
                      <View style={{marginTop: 20, marginBottom: 20}}>
                        <Text style={{color: '#FFD700', marginBottom: 10, fontWeight: 'bold'}}>Zájemci o tuto práci:</Text>
                        {selectedOrder.applicants.map((applicant: any) => (
                          <TouchableOpacity 
                            key={applicant.uid} 
                            style={styles.applicantCard} 
                            onPress={() => handleApproveWorker(selectedOrder.id, applicant.uid)}
                          >
                            <View>
                              <Text style={{color: '#FFF', fontWeight: 'bold'}}>{applicant.name}</Text>
                              <Text style={{color: '#FFD700', fontSize: 12}}>⭐️ {Number(applicant.rating || 5.0).toFixed(1)}</Text>
                            </View>
                            <Text style={{color: '#00BFFF', fontWeight: 'bold'}}>Vybrat mistra</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity 
                      style={[styles.callBtn, (!currentUser || !isProfileComplete()) ? {backgroundColor: '#222'} : {backgroundColor: '#444'}]} 
                      onPress={handleCallClick}
                    > 
                      <Ionicons name="call" size={20} color={(currentUser && isProfileComplete()) ? "#FFF" : "#555"} /> 
                      <Text style={[styles.callBtnText, (!currentUser || !isProfileComplete()) ? {color: '#555'} : {color: '#FFF'}]}>
                        {maskContact(selectedOrder.phone, 'phone')}
                      </Text> 
                    </TouchableOpacity> 

                    {/* ДІЇ АДМІНІСТРАТОРА */}
                    {currentUser?.email === ADMIN_EMAIL && ( 
                      <View style={{marginTop: 30, gap: 15, borderTopWidth: 1, borderColor: '#333', paddingTop: 20}}> 
                        <Text style={{color: '#666', textAlign: 'center'}}>Admin zóna</Text>
                        {selectedOrder.status === 'PENDING' && ( 
                          <TouchableOpacity style={[styles.callBtn, {backgroundColor: '#00BFFF'}]} onPress={async()=>{
                            await updateDoc(doc(db,"poptavky",selectedOrder.id), {status: 'APPROVED'}); 
                            setSelectedOrder(null);
                          }}> 
                            <Text style={styles.callBtnText}>Schválit zakázku</Text> 
                          </TouchableOpacity> 
                        )} 
                        <TouchableOpacity style={{padding: 15, borderWidth: 1, borderColor: '#FF4444', borderRadius: 15, alignItems: 'center'}} onPress={async()=>{
                          await deleteDoc(doc(db,"poptavky",selectedOrder.id)); 
                          setSelectedOrder(null);
                        }}> 
                          <Text style={{color:'#FF4444', fontWeight:'bold'}}>Smazat zakázku</Text> 
                        </TouchableOpacity> 
                      </View> 
                    )} 
                  </ScrollView>
                )} 
              </View>
            </View> 
          </Modal> 
        </KeyboardAvoidingView> 
      </View> 
    </ImageBackground> 
  ); 
} 

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const styles = StyleSheet.create({ 
  backgroundImage: { flex: 1, backgroundColor: '#000' }, 
  darkOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
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
  label: { color: '#888888', marginBottom: 5, marginTop: 10, fontSize: 12 }, 
  input: { backgroundColor: '#111', color: '#FFF', borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#333' }, 
  goldBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center' }, 
  goldBtnText: { color: '#000', fontWeight: 'bold' }, 
  statsContainer: { flexDirection: 'row', width: '92%', backgroundColor: 'rgba(15,15,20,0.9)', borderRadius: 20, padding: 15, marginTop: 20, borderWidth:1, borderColor:'#333' }, 
  statBox: { flex: 1, alignItems: 'center' }, 
  statLabel: { color: '#888888', fontSize: 11 }, 
  statValue: { color: '#00BFFF', fontSize: 20, fontWeight: 'bold' }, 
  listSection: { width: '92%', marginTop: 25 }, 
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, 
  toggleContainer: { flexDirection: 'row', backgroundColor: '#222', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#333' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, gap: 5 },
  toggleBtnActive: { backgroundColor: '#FFD700' },
  toggleText: { color: '#888888', fontSize: 12, fontWeight: 'bold' },
  filterWrapper: { marginBottom: 15, height: 35 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: '#222', borderWidth: 1, borderColor: '#444', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterChipText: { color: '#888888', fontSize: 11, fontWeight: 'bold' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 20, width: '100%', gap: 10, paddingHorizontal: 5 },
  checkboxLabel: { color: '#CCC', fontSize: 13 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5, borderWidth: 1, borderColor: '#444' },
  ratingText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
  mapContainer: { height: 400, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  map: { width: '100%', height: '100%' },
  orderCard: { backgroundColor: 'rgba(15, 15, 20, 0.9)', borderRadius: 18, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#333' }, 
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }, 
  orderCats: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' }, 
  orderDate: { color: '#888888', fontSize: 11, fontWeight: '500' }, 
  viewsBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 }, 
  viewsText: { color: '#00BFFF', fontSize: 12 }, 
  orderTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }, 
  orderPrice: { color: '#FFD700', fontSize: 14, marginVertical: 5 }, 
  applicantCard: { backgroundColor: '#222', padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }, 
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '85%' }, 
  closeBtn: { alignSelf: 'flex-end', padding: 5, marginBottom: 10 }, 
  modalCats: { color: '#00BFFF', fontSize: 12 }, 
  modalTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginVertical: 10 }, 
  modalInfoRow: { flexDirection: 'row', gap: 15, marginVertical: 20 }, 
  infoBox: { flex: 1, backgroundColor: '#1A1A24', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#333' }, 
  infoLabel: { color: '#888888', fontSize: 10, fontWeight: 'bold', marginBottom: 5 }, 
  infoValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, 
  modalDesc: { color: '#CCC', fontSize: 16, lineHeight: 24, marginBottom: 20 }, 
  callBtn: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 15, gap: 10 }, 
  callBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }, 
  footerContainer: { marginTop: 40, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center' }, 
  footerDivider: { width: '40%', height: 1, backgroundColor: '#FFD700', marginBottom: 20 }, 
  footerText: { color: '#888888', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  
  // СТИЛІ DASHBOARD
  dashboardMainTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  emptyStateContainer: { alignItems: 'center', backgroundColor: '#111', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  emptyStateText: { color: '#888888', textAlign: 'center', marginTop: 15, fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  urgentActionBox: { marginTop: 15, backgroundColor: '#FFD700', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }
});