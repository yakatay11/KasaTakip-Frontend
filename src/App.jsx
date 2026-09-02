import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { Toaster, toast } from 'react-hot-toast'

const API_URL = "https://kasa-takip-byfabric.onrender.com/api"; 

// --- SABİT KATEGORİ LİSTESİ ---
const SABIT_KATEGORILER = [
  'Fatura (Elektrik, Su, Doğalgaz, İnternet)',
  'Kira',
  'Ofis Malzemeleri',
  'Ulaşım ve Akaryakıt',
  'Maaş ve Personel',
  'Yemek ve İkram',
  'Bakım ve Onarım',
  'Diğer'
];

function App() {
  const [girisYapanKullanici, setGirisYapanKullanici] = useState(() => {
    const savedUser = localStorage.getItem('kasa_girisYapanKullanici');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loginForm, setLoginForm] = useState({ kullaniciAdi: '', sifre: '' });
  const [yukleniyor, setYukleniyor] = useState(false);

  // --- KARANLIK MOD STATE'İ ---
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('kasa_darkMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('kasa_darkMode', darkMode);
  }, [darkMode]);

  // --- ŞİFRE GÜNCELLEME STATE'İ ---
  const [sifreForm, setSifreForm] = useState({ yeniSifre: '', yeniSifreTekrar: '' });

  const [giderler, setGiderler] = useState([]);
  const [gelirler, setGelirler] = useState([]);
  const [arşivRaporlar, setArşivRaporlar] = useState([]);
  const [giderTalepleri, setGiderTalepleri] = useState([]);
  const [kullanicilar, setKullanicilar] = useState([]);

  // --- DÜZENLEME STATE'LERİ ---
  const [duzenlenenGelirId, setDuzenlenenGelirId] = useState(null);
  const [duzenlenenGiderId, setDuzenlenenGiderId] = useState(null);
  const [duzenlenenKullaniciId, setDuzenlenenKullaniciId] = useState(null);

  // --- İŞLEMLER SEKME ARAMASI VE SIRALAMA ---
  const [islemArama, setIslemArama] = useState('');
  const [gelirSiralama, setGelirSiralama] = useState('yeni');
  const [giderSiralama, setGiderSiralama] = useState('yeni');

  // --- RAPORLAR FİLTRELEME STATE'LERİ ---
  const [raporArama, setRaporArama] = useState('');
  const [raporBaslangic, setRaporBaslangic] = useState('');
  const [raporBitis, setRaporBitis] = useState('');
  const [raporKategori, setRaporKategori] = useState('');
  const [secilenAy, setSecilenAy] = useState(null);

  // --- FORM STATE'LERİ & TASLAK ID'LERİ ---
  const [giderForm, setGiderForm] = useState(() => {
    const saved = localStorage.getItem('kasa_giderForm');
    return saved ? JSON.parse(saved) : { kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', aciklama: '' };
  });
  const [giderTaslakId, setGiderTaslakId] = useState(() => {
    const savedId = localStorage.getItem('kasa_giderTaslakId');
    return savedId ? parseInt(savedId) : null;
  });

  const [gelirForm, setGelirForm] = useState(() => {
    const saved = localStorage.getItem('kasa_gelirForm');
    return saved ? JSON.parse(saved) : { kaynak: '', tutar: '', aciklama: '' };
  });
  const [gelirTaslakId, setGelirTaslakId] = useState(() => {
    const savedId = localStorage.getItem('kasa_gelirTaslakId');
    return savedId ? parseInt(savedId) : null;
  });

  const [talepForm, setTalepForm] = useState(() => {
    const saved = localStorage.getItem('kasa_talepForm');
    return saved ? JSON.parse(saved) : { kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', aciklama: '' };
  });
  const [talepTaslakId, setTalepTaslakId] = useState(() => {
    const savedId = localStorage.getItem('kasa_talepTaslakId');
    return savedId ? parseInt(savedId) : null;
  });

  const [yeniKullaniciForm, setYeniKullaniciForm] = useState({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
  const [aktifSekme, setAktifSekme] = useState('islemler');

  // --- LOCAL STORAGE YEDEKLEMELERİ ---
  useEffect(() => localStorage.setItem('kasa_giderForm', JSON.stringify(giderForm)), [giderForm]);
  useEffect(() => localStorage.setItem('kasa_gelirForm', JSON.stringify(gelirForm)), [gelirForm]);
  useEffect(() => localStorage.setItem('kasa_talepForm', JSON.stringify(talepForm)), [talepForm]);

  // ==========================================
  // 1. GİDER İÇİN OTOMATİK KAYIT (AUTO-SAVE)
  // ==========================================
  useEffect(() => {
    if (!girisYapanKullanici || girisYapanKullanici.rol === 'Personel') return;
    if (duzenlenenGiderId) return; 
    if (!giderForm.kimeOdenecek && !giderForm.tutar && !giderForm.kategori && !giderForm.aciklama) return;

    const timer = setTimeout(async () => {
      const userRol = girisYapanKullanici.rol;
      if (giderTaslakId) {
        try {
          await fetch(`${API_URL}/Gider/${giderTaslakId}?rol=${userRol}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kimeOdendi: giderForm.kimeOdenecek || '-',
              kategori: giderForm.kategori || 'Diğer',
              tutar: parseFloat(giderForm.tutar) || 0,
              aciklama: giderForm.aciklama || 'Taslak Kayıt',
              tarih: new Date().toISOString(),
              islemiYapanAdminId: girisYapanKullanici.id
            })
          });
          verileriGetir();
        } catch (error) { console.error("Taslak güncelleme hatası:", error); }
      } else {
        if (giderForm.kimeOdenecek || giderForm.tutar) {
          try {
            const response = await fetch(`${API_URL}/Gider`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kimeOdendi: giderForm.kimeOdenecek || '-',
                kategori: giderForm.kategori || 'Diğer',
                tutar: parseFloat(giderForm.tutar) || 0,
                aciklama: giderForm.aciklama || 'Taslak Kayıt',
                tarih: new Date().toISOString(),
                islemiYapanAdminId: girisYapanKullanici.id
              })
            });
            if (response.ok) {
              const data = await response.json();
              setGiderTaslakId(data.id);
              localStorage.setItem('kasa_giderTaslakId', data.id);
              verileriGetir();
            }
          } catch (error) { console.error("Taslak oluşturma hatası:", error); }
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [giderForm, giderTaslakId, girisYapanKullanici, duzenlenenGiderId]);

  // ==========================================
  // 2. GELİR İÇİN OTOMATİK KAYIT (AUTO-SAVE)
  // ==========================================
  useEffect(() => {
    if (!girisYapanKullanici || girisYapanKullanici.rol === 'Personel') return;
    if (duzenlenenGelirId) return; 
    if (!gelirForm.kaynak && !gelirForm.tutar && !gelirForm.aciklama) return;

    const timer = setTimeout(async () => {
      if (gelirTaslakId) {
        try {
          await fetch(`${API_URL}/Gelir/${gelirTaslakId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kaynak: gelirForm.kaynak || '-',
              tutar: parseFloat(gelirForm.tutar) || 0,
              aciklama: gelirForm.aciklama || 'Taslak Kayıt',
              tarih: new Date().toISOString()
            })
          });
          verileriGetir();
        } catch (error) { console.error("Taslak güncelleme hatası:", error); }
      } else {
        if (gelirForm.kaynak || gelirForm.tutar) {
          try {
            const response = await fetch(`${API_URL}/Gelir`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kaynak: gelirForm.kaynak || '-',
                tutar: parseFloat(gelirForm.tutar) || 0,
                aciklama: gelirForm.aciklama || 'Taslak Kayıt',
                tarih: new Date().toISOString()
              })
            });
            if (response.ok) {
              const data = await response.json();
              setGelirTaslakId(data.id);
              localStorage.setItem('kasa_gelirTaslakId', data.id);
              verileriGetir();
            }
          } catch (error) { console.error("Taslak oluşturma hatası:", error); }
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [gelirForm, gelirTaslakId, girisYapanKullanici, duzenlenenGelirId]);

  // ==========================================
  // 3. TALEP İÇİN OTOMATİK KAYIT (AUTO-SAVE)
  // ==========================================
  useEffect(() => {
    if (!girisYapanKullanici || girisYapanKullanici.rol !== 'Personel') return;
    if (!talepForm.kimeOdenecek && !talepForm.tutar && !talepForm.kategori && !talepForm.aciklama) return;

    const timer = setTimeout(async () => {
      if (talepTaslakId) {
        try {
          await fetch(`${API_URL}/GiderTalebi/${talepTaslakId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              talepEdenPersonelId: girisYapanKullanici.id,
              kimeOdenecek: talepForm.kimeOdenecek || '-',
              kategori: talepForm.kategori || 'Diğer',
              tutar: parseFloat(talepForm.tutar) || 0,
              aciklama: talepForm.aciklama || 'Taslak Kayıt',
              tarih: new Date().toISOString()
            })
          });
          verileriGetir();
        } catch (error) { console.error("Taslak güncelleme hatası:", error); }
      } else {
        if (talepForm.kimeOdenecek || talepForm.tutar) {
          try {
            const response = await fetch(`${API_URL}/GiderTalebi`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                talepEdenPersonelId: girisYapanKullanici.id,
                kimeOdenecek: talepForm.kimeOdenecek || '-',
                kategori: talepForm.kategori || 'Diğer',
                tutar: parseFloat(talepForm.tutar) || 0,
                aciklama: talepForm.aciklama || 'Taslak Kayıt',
                tarih: new Date().toISOString()
              })
            });
            if (response.ok) {
              const data = await response.json();
              setTalepTaslakId(data.id);
              localStorage.setItem('kasa_talepTaslakId', data.id);
              verileriGetir();
            }
          } catch (error) { console.error("Taslak oluşturma hatası:", error); }
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [talepForm, talepTaslakId, girisYapanKullanici]);

  // --- TEMEL FONKSİYONLAR ---
  const verileriGetir = async () => {
    try {
      const giderRes = await fetch(`${API_URL}/Gider`);
      const gelirRes = await fetch(`${API_URL}/Gelir`);
      const raporRes = await fetch(`${API_URL}/AylikRapor`);
      const talepRes = await fetch(`${API_URL}/GiderTalebi`);
      const kulRes = await fetch(`${API_URL}/Kullanici`);
      
      if (giderRes.ok) setGiderler(await giderRes.json());
      if (gelirRes.ok) setGelirler(await gelirRes.json());
      if (raporRes.ok) setArşivRaporlar(await raporRes.json());
      if (talepRes.ok) setGiderTalepleri(await talepRes.json());
      if (kulRes.ok) setKullanicilar(await kulRes.json());
    } catch (error) { console.error("Veri çekme hatası:", error); }
  };

  useEffect(() => {
    if (girisYapanKullanici) verileriGetir();
  }, [girisYapanKullanici]);

  const girisYap = async (e) => {
    e.preventDefault();
    setYukleniyor(true);
    try {
      const response = await fetch(`${API_URL}/Kullanici/giris`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      const contentType = response.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (response.ok) {
        const userData = { id: data.id, adSoyad: data.adSoyad, rol: data.rol };
        setGirisYapanKullanici(userData);
        localStorage.setItem('kasa_girisYapanKullanici', JSON.stringify(userData));
        toast.success(`Hoş geldiniz, ${data.adSoyad}`);
        if (data.rol === 'Personel') setAktifSekme('talepler');
        else setAktifSekme('islemler');
      } else { 
        toast.error(data.message || "Giriş başarısız!"); 
      }
    } catch (error) { 
      console.error("Giriş hatası:", error); 
      toast.error("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  const cikisYap = () => {
    setGirisYapanKullanici(null);
    localStorage.removeItem('kasa_girisYapanKullanici');
    setLoginForm({ kullaniciAdi: '', sifre: '' });
    toast.success("Çıkış yapıldı.");
  };

  // --- ŞİFRE GÜNCELLEME İŞLEMİ ---
  const sifreGuncelle = async (e) => {
    e.preventDefault();
    if (!sifreForm.yeniSifre) {
      toast.error("Lütfen yeni şifreyi giriniz.");
      return;
    }
    if (sifreForm.yeniSifre !== sifreForm.yeniSifreTekrar) {
      toast.error("Şifreler birbiriyle eşleşmiyor!");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/Kullanici/${girisYapanKullanici.id}/sifre`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sifre: sifreForm.yeniSifre })
      });

      if (response.ok) {
        toast.success("Şifreniz başarıyla güncellendi.");
        setSifreForm({ yeniSifre: '', yeniSifreTekrar: '' });
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.message || "Şifre güncellenemedi.");
      }
    } catch (error) {
      console.error("Şifre güncelleme hatası:", error);
      toast.error("Sunucu bağlantı hatası.");
    }
  };

  // --- KULLANICI EKLE / GÜNCELLE ---
  const kullaniciKaydetVeyaGuncelle = async (e) => {
    e.preventDefault();
    try {
      if (duzenlenenKullaniciId) {
        const response = await fetch(`${API_URL}/Kullanici/${duzenlenenKullaniciId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(yeniKullaniciForm)
        });
        if (response.ok) {
          toast.success("Kullanıcı başarıyla güncellendi.");
          setDuzenlenenKullaniciId(null);
          setYeniKullaniciForm({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
          verileriGetir();
        } else {
          const errData = await response.json().catch(() => ({}));
          toast.error(errData.message || "Kullanıcı güncellenemedi.");
        }
      } else {
        const response = await fetch(`${API_URL}/Kullanici`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(yeniKullaniciForm)
        });
        if (response.ok) {
          setYeniKullaniciForm({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
          verileriGetir();
          toast.success("Kullanıcı başarıyla eklendi.");
        } else {
          const errData = await response.json().catch(() => ({}));
          toast.error(errData.message || "Kullanıcı eklenemedi.");
        }
      }
    } catch (error) {
      console.error("Kullanıcı işlem hatası:", error);
      toast.error("İşlem sırasında bir hata oluştu.");
    }
  };

  const kullaniciDuzenleBaslat = (kul) => {
    setDuzenlenenKullaniciId(kul.id);
    setYeniKullaniciForm({
      adSoyad: kul.adSoyad,
      kullaniciAdi: kul.kullaniciAdi,
      sifre: '',
      rol: kul.rol
    });
  };

  const kullaniciSil = async (id) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`${API_URL}/Kullanici/${id}`, { method: 'DELETE' });
      if (response.ok) {
        verileriGetir();
        toast.success("Kullanıcı başarıyla silindi.");
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.message || "Kullanıcı silinemedi.");
      }
    } catch (error) {
      console.error("Silme hatası:", error);
      toast.error("Kullanıcı silme hatası.");
    }
  };

  // --- GİDER EKLE / GÜNCELLE ---
  const giderEkle = async (e) => {
    e.preventDefault();
    if (!giderForm.kimeOdenecek || !giderForm.tutar) return;

    try {
      const userRol = girisYapanKullanici ? girisYapanKullanici.rol : '';
      if (duzenlenenGiderId) {
        await fetch(`${API_URL}/Gider/${duzenlenenGiderId}?rol=${userRol}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori || 'Diğer',
            tutar: parseFloat(giderForm.tutar), aciklama: giderForm.aciklama,
            tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
          })
        });
        setDuzenlenenGiderId(null);
        toast.success("Gider başarıyla güncellendi.");
      } else {
        if (giderTaslakId) {
          await fetch(`${API_URL}/Gider/${giderTaslakId}?rol=${userRol}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori || 'Diğer',
              tutar: parseFloat(giderForm.tutar), aciklama: giderForm.aciklama,
              tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
            })
          });
          toast.success("Gider kaydedildi.");
        } else {
          await fetch(`${API_URL}/Gider`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori || 'Diğer',
              tutar: parseFloat(giderForm.tutar), aciklama: giderForm.aciklama,
              tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
            })
          });
          toast.success("Gider eklendi.");
        }
      }

      setGiderForm({ kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', aciklama: '' });
      setGiderTaslakId(null);
      localStorage.removeItem('kasa_giderForm');
      localStorage.removeItem('kasa_giderTaslakId');
      verileriGetir();
    } catch (error) { 
      console.error("Gider ekleme hatası:", error); 
      toast.error("İşlem sırasında hata oluştu.");
    }
  };

  const giderDuzenleBaslat = (item) => {
    setDuzenlenenGiderId(item.id);
    setGiderForm({ kimeOdenecek: item.kimeOdendi, kategori: item.kategori || 'Diğer', tutar: item.tutar, aciklama: item.aciklama || '' });
  };

  const giderSil = async (id) => {
    if (!window.confirm("Bu gideri silmek istediğinize emin misiniz?")) return;
    try {
      const userRol = girisYapanKullanici ? girisYapanKullanici.rol : '';
      const response = await fetch(`${API_URL}/Gider/${id}?rol=${userRol}`, { method: 'DELETE' });
      if (response.ok) {
        if (id === giderTaslakId) {
           setGiderTaslakId(null);
           setGiderForm({ kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', aciklama: '' });
           localStorage.removeItem('kasa_giderForm');
           localStorage.removeItem('kasa_giderTaslakId');
        }
        verileriGetir();
        toast.success("Gider silindi.");
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.message || "Bu işlem için yetkiniz yok.");
      }
    } catch (error) { 
      console.error("Silme hatası:", error); 
      toast.error("Silme başarısız.");
    }
  };

  // --- GELİR EKLE / GÜNCELLE ---
  const gelirEkle = async (e) => {
    e.preventDefault();
    if (!gelirForm.kaynak || !gelirForm.tutar) return;

    try {
      if (duzenlenenGelirId) {
        await fetch(`${API_URL}/Gelir/${duzenlenenGelirId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kaynak: gelirForm.kaynak, tutar: parseFloat(gelirForm.tutar),
            aciklama: gelirForm.aciklama, tarih: new Date().toISOString()
          })
        });
        setDuzenlenenGelirId(null);
        toast.success("Gelir başarıyla güncellendi.");
      } else {
        if (gelirTaslakId) {
          await fetch(`${API_URL}/Gelir/${gelirTaslakId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kaynak: gelirForm.kaynak, tutar: parseFloat(gelirForm.tutar),
              aciklama: gelirForm.aciklama, tarih: new Date().toISOString()
            })
          });
          toast.success("Gelir kaydedildi.");
        } else {
          await fetch(`${API_URL}/Gelir`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kaynak: gelirForm.kaynak, tutar: parseFloat(gelirForm.tutar),
              aciklama: gelirForm.aciklama, tarih: new Date().toISOString()
            })
          });
          toast.success("Gelir eklendi.");
        }
      }

      setGelirForm({ kaynak: '', tutar: '', aciklama: '' });
      setGelirTaslakId(null);
      localStorage.removeItem('kasa_gelirForm');
      localStorage.removeItem('kasa_gelirTaslakId');
      verileriGetir();
    } catch (error) { 
      console.error("Gelir ekleme hatası:", error); 
      toast.error("Gelir eklenirken hata oluştu.");
    }
  };

  const gelirDuzenleBaslat = (item) => {
    setDuzenlenenGelirId(item.id);
    setGelirForm({ kaynak: item.kaynak, tutar: item.tutar, aciklama: item.aciklama || '' });
  };

  const gelirSil = async (id) => {
    if (!window.confirm("Bu geliri silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`${API_URL}/Gelir/${id}`, { method: 'DELETE' });
      if (response.ok) {
        if (id === gelirTaslakId) {
           setGelirTaslakId(null);
           setGelirForm({ kaynak: '', tutar: '', aciklama: '' });
           localStorage.removeItem('kasa_gelirForm');
           localStorage.removeItem('kasa_gelirTaslakId');
        }
        verileriGetir();
        toast.success("Gelir silindi.");
      } else {
        toast.error("Gelir silinemedi.");
      }
    } catch (error) { 
      console.error("Gelir silme hatası:", error); 
      toast.error("Gelir silme hatası.");
    }
  };

  const talepEkle = async (e) => {
    e.preventDefault();
    if (!talepForm.kimeOdenecek || !talepForm.tutar) return;

    try {
      if (talepTaslakId) {
        await fetch(`${API_URL}/GiderTalebi/${talepTaslakId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            talepEdenPersonelId: girisYapanKullanici.id,
            kimeOdenecek: talepForm.kimeOdenecek, kategori: talepForm.kategori || 'Diğer',
            tutar: parseFloat(talepForm.tutar), aciklama: talepForm.aciklama,
            tarih: new Date().toISOString()
          })
        });
      } else {
        await fetch(`${API_URL}/GiderTalebi`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            talepEdenPersonelId: girisYapanKullanici.id,
            kimeOdenecek: talepForm.kimeOdenecek, kategori: talepForm.kategori || 'Diğer',
            tutar: parseFloat(talepForm.tutar), aciklama: talepForm.aciklama,
            tarih: new Date().toISOString()
          })
        });
      }

      setTalepForm({ kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', aciklama: '' });
      setTalepTaslakId(null);
      localStorage.removeItem('kasa_talepForm');
      localStorage.removeItem('kasa_talepTaslakId');
      verileriGetir();
      toast.success("Gelir/Gider talebi başarıyla oluşturuldu.");
    } catch (error) { 
      console.error("Talep oluşturma hatası:", error); 
      toast.error("Talep oluşturulamadı.");
    }
  };

  const talepOnayla = async (id) => {
    try {
      const response = await fetch(`${API_URL}/GiderTalebi/${id}/onayla`, { method: 'PUT' });
      if (response.ok) {
        verileriGetir();
        toast.success("Talep onaylandı ve kasaya işlendi.");
      }
    } catch (error) { 
      console.error("Talep onaylama hatası:", error); 
      toast.error("Onaylama başarısız.");
    }
  };

  // --- İŞLEMLER İÇİN YEREL FİLTRELEME VE SIRALAMA ---
  const filtrelenmisGelirler = gelirler.filter(item => 
    (item.kaynak || '').toLowerCase().includes(islemArama.toLowerCase()) ||
    (item.aciklama || '').toLowerCase().includes(islemArama.toLowerCase())
  );

  const siralanmisGelirler = [...filtrelenmisGelirler].sort((a, b) => {
    if (gelirSiralama === 'yeni') return new Date(b.tarih) - new Date(a.tarih);
    if (gelirSiralama === 'eski') return new Date(a.tarih) - new Date(b.tarih);
    if (gelirSiralama === 'tutar-azalan') return b.tutar - a.tutar;
    if (gelirSiralama === 'tutar-artan') return a.tutar - b.tutar;
    return 0;
  });
  
  const filtrelenmisGiderler = giderler.filter(item => 
    (item.kimeOdendi || '').toLowerCase().includes(islemArama.toLowerCase()) ||
    (item.kategori || '').toLowerCase().includes(islemArama.toLowerCase()) ||
    (item.aciklama || '').toLowerCase().includes(islemArama.toLowerCase())
  );

  const siralanmisGiderler = [...filtrelenmisGiderler].sort((a, b) => {
    if (giderSiralama === 'yeni') return new Date(b.tarih) - new Date(a.tarih);
    if (giderSiralama === 'eski') return new Date(a.tarih) - new Date(b.tarih);
    if (giderSiralama === 'tutar-azalan') return b.tutar - a.tutar;
    if (giderSiralama === 'tutar-artan') return a.tutar - b.tutar;
    return 0;
  });

  // --- İŞLEM GEÇMİŞİ (AUDIT TRAIL) LİSTESİ ---
  const tumIslemGecmisi = [
    ...gelirler.map(g => ({ id: `gelir-${g.id}`, tur: 'Gelir Ekleme', aciklama: `${g.kaynak} - ${g.aciklama || '-'}`, tutar: g.tutar, tip: 'gelir', tarih: g.tarih })),
    ...giderler.map(gi => ({ id: `gider-${gi.id}`, tur: 'Gider Ekleme', aciklama: `${gi.kimeOdendi} (${gi.kategori}) - ${gi.aciklama || '-'}`, tutar: gi.tutar, tip: 'gider', tarih: gi.tarih })),
    ...giderTalepleri.map(t => ({ id: `talep-${t.id}`, tur: `Talep (${t.durum})`, aciklama: `${t.kimeOdenecek} (${t.kategori}) - ${t.aciklama || '-'}`, tutar: t.tutar, tip: 'talep', tarih: t.tarih }))
  ].sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

  // --- RAPORLAR İÇİN DETAYLI FİLTRELEME ---
  const raporTarihFiltresi = (tarih) => {
    if (!raporBaslangic && !raporBitis) return true;
    const itemDate = new Date(tarih).toISOString().split('T')[0];
    if (raporBaslangic && itemDate < raporBaslangic) return false;
    if (raporBitis && itemDate > raporBitis) return false;
    return true;
  };

  const raporIcinGelirler = gelirler.filter(item => {
    const metinUyumu = (item.kaynak || '').toLowerCase().includes(raporArama.toLowerCase()) ||
                       (item.aciklama || '').toLowerCase().includes(raporArama.toLowerCase());
    const kategoriUyumu = raporKategori ? false : true; 
    return metinUyumu && raporTarihFiltresi(item.tarih) && kategoriUyumu;
  });

  const raporIcinGiderler = giderler.filter(item => {
    const metinUyumu = (item.kimeOdendi || '').toLowerCase().includes(raporArama.toLowerCase()) ||
                       (item.kategori || '').toLowerCase().includes(raporArama.toLowerCase()) ||
                       (item.aciklama || '').toLowerCase().includes(raporArama.toLowerCase());
    const kategoriUyumu = raporKategori ? item.kategori === raporKategori : true;
    return metinUyumu && raporTarihFiltresi(item.tarih) && kategoriUyumu;
  });

  // --- AKILLI ÖZET HESAPLAMALARI ---
  const raporToplamGelir = raporIcinGelirler.reduce((acc, i) => acc + i.tutar, 0);
  const raporToplamGider = raporIcinGiderler.reduce((acc, i) => acc + i.tutar, 0);
  const kategoriHarcamalari = raporIcinGiderler.reduce((acc, item) => {
    const cat = item.kategori || 'Diğer';
    acc[cat] = (acc[cat] || 0) + item.tutar;
    return acc;
  }, {});
  const enYuksekKategori = Object.entries(kategoriHarcamalari).reduce((max, curr) => curr[1] > (max[1] || 0) ? curr : max, [null, 0]);

  // --- RAPORLARI OLUŞTURMA ---
  const aylikRapor = {};
  [...raporIcinGelirler.map(i => ({ ...i, tip: 'gelir' })), ...raporIcinGiderler.map(i => ({ ...i, tip: 'gider' }))].forEach(item => {
    const tarihObj = new Date(item.tarih);
    const ayYil = tarihObj.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    if (!aylikRapor[ayYil]) aylikRapor[ayYil] = { gelir: 0, gider: 0, detaylar: [] };
    if (item.tip === 'gelir') aylikRapor[ayYil].gelir += item.tutar;
    else aylikRapor[ayYil].gider += item.tutar;
    aylikRapor[ayYil].detaylar.push(item);
  });

  const toplamGelir = gelirler.reduce((toplam, item) => toplam + item.tutar, 0);
  const toplamGider = giderler.reduce((toplam, item) => toplam + item.tutar, 0);
  const netBakiye = toplamGelir - toplamGider;

  const raporlariArsivle = async () => {
    try {
      for (const [ay, veri] of Object.entries(aylikRapor)) {
        await fetch(`${API_URL}/AylikRapor/olustur`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ayYil: ay, toplamGelir: veri.gelir, toplamGider: veri.gider, netBakiye: veri.gelir - veri.gider })
        });
      }
      verileriGetir();
      toast.success("Aylık raporlar başarıyla arşivlendi!");
    } catch (error) { 
      console.error("Arşivleme hatası:", error); 
      toast.error("Arşivleme başarısız.");
    }
  };

  const excelIndir = () => {
    const veriDizisi = Object.entries(aylikRapor).map(([ay, veri]) => ({
      "Ay / Yıl": ay, "Toplam Gelir (TL)": veri.gelir, "Toplam Gider (TL)": veri.gider, "Net Durum (TL)": veri.gelir - veri.gider
    }));
    const worksheet = XLSX.utils.json_to_sheet(veriDizisi);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AylikRapor");
    XLSX.writeFile(workbook, "Aylik_Finansal_Rapor.xlsx");
    toast.success("Excel raporu indirildi.");
  };

  const pdfIndir = () => {
    const doc = new jsPDF();
    doc.text("Kasa Takip Sistemi - Aylik Finansal Rapor", 14, 15);
    const tableColumn = ["Ay / Yıl", "Toplam Gelir", "Toplam Gider", "Net Durum"];
    const tableRows = [];
    Object.entries(aylikRapor).forEach(([ay, veri]) => {
      const net = veri.gelir - veri.gider;
      tableRows.push([ay, `${veri.gelir.toLocaleString('tr-TR')} TL`, `${veri.gider.toLocaleString('tr-TR')} TL`, `${net.toLocaleString('tr-TR')} TL`]);
    });
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 25 });
    doc.save("Aylik_Finansal_Rapor.pdf");
    toast.success("PDF raporu indirildi.");
  };

  if (!girisYapanKullanici) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-white'} flex items-center justify-center p-6 transition-colors`}>
        <Toaster position="top-right" />
        <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6 transition-colors`}>
          <div className="text-center space-y-2">
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Kasa Takip Sistemi</h1>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lütfen kullanıcı bilgileriyle giriş yapın</p>
          </div>
          <form onSubmit={girisYap} className="space-y-4">
            <div>
              <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-1`}>Kullanıcı Adı</label>
              <input
                type="text" value={loginForm.kullaniciAdi}
                onChange={(e) => setLoginForm({ ...loginForm, kullaniciAdi: e.target.value })}
                className={`w-full border ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900'} rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                placeholder="Kullanıcı adınızı girin" required
              />
            </div>
            <div>
              <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-1`}>Şifre</label>
              <input
                type="password" value={loginForm.sifre}
                onChange={(e) => setLoginForm({ ...loginForm, sifre: e.target.value })}
                className={`w-full border ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900'} rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                placeholder="••••••••" required
              />
            </div>
            <button 
              type="submit" 
              disabled={yukleniyor}
              className={`w-full text-white font-medium py-3 rounded-lg transition text-sm shadow-sm ${yukleniyor ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {yukleniyor ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const cardBg = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400';
  const tableHeader = darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-400';
  const tableRowHover = darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50';
  const tableDivider = darkMode ? 'divide-slate-800 text-slate-300' : 'divide-slate-50 text-slate-600';

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} p-6 transition-colors`}>
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ÜST BİLGİ & TEMA DEĞİŞTİRME */}
        <div className={`flex justify-between items-center ${cardBg} p-4 rounded-xl shadow-sm border transition-colors`}>
          <div>
            <h1 className="text-xl font-bold">Kasa Takip Sistemi</h1>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Hoş geldiniz, <span className="font-semibold">{girisYapanKullanici.adSoyad}</span> ({girisYapanKullanici.rol})</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className={`px-3 py-2 rounded-lg text-xs font-medium transition ${darkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {darkMode ? '☀️ Aydınlık' : '🌙 Karanlık'}
            </button>
            <button onClick={cikisYap} className={`px-4 py-2 rounded-lg text-xs font-medium transition ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* SEKMELER */}
        <div className={`flex justify-start items-center flex-wrap gap-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} pb-3 w-full`}>
          {girisYapanKullanici.rol !== 'Personel' && (
            <button
              onClick={() => setAktifSekme('islemler')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'islemler' ? 'bg-blue-600 text-white shadow-sm' : `${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}`}
            >
              Kasa & İşlem Yönetimi
            </button>
          )}

          <button
            onClick={() => setAktifSekme('talepler')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'talepler' ? 'bg-blue-600 text-white shadow-sm' : `${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}`}
          >
            {girisYapanKullanici.rol === 'Personel' ? 'Gelir/Gider Taleplerim' : 'Gelir/Gider Talepleri Onay'}
          </button>

          {girisYapanKullanici.rol !== 'Personel' && (
            <button
              onClick={() => setAktifSekme('raporlar')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'raporlar' ? 'bg-blue-600 text-white shadow-sm' : `${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}`}
            >
              Günlük & Aylık Raporlar
            </button>
          )}

          {girisYapanKullanici.rol !== 'Personel' && (
            <button
              onClick={() => setAktifSekme('gecmis')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'gecmis' ? 'bg-blue-600 text-white shadow-sm' : `${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}`}
            >
              İşlem Geçmişi
            </button>
          )}

          {girisYapanKullanici.rol === 'Yonetici' && (
            <button
              onClick={() => setAktifSekme('kullanicilar')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'kullanicilar' ? 'bg-blue-600 text-white shadow-sm' : `${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}`}
            >
              Kullanıcı Yönetimi
            </button>
          )}
        </div>

        {/* ÖZET KARTLAR */}
        {girisYapanKullanici.rol !== 'Personel' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardBg} p-5 rounded-xl shadow-sm border transition-colors`}>
              <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>Toplam Gelir</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{toplamGelir.toLocaleString('tr-TR')} TL</h3>
            </div>
            <div className={`${cardBg} p-5 rounded-xl shadow-sm border transition-colors`}>
              <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>Toplam Gider</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{toplamGider.toLocaleString('tr-TR')} TL</h3>
            </div>
            <div className={`${cardBg} p-5 rounded-xl shadow-sm border transition-colors`}>
              <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>Net Kasa Durumu</p>
              <h3 className={`text-2xl font-bold mt-1 ${netBakiye >= 0 ? 'text-blue-500' : 'text-red-600'}`}>
                {netBakiye.toLocaleString('tr-TR')} TL
              </h3>
            </div>
          </div>
        )}

        {/* İŞLEMLER SEKMESİ */}
        {aktifSekme === 'islemler' && girisYapanKullanici.rol !== 'Personel' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`${cardBg} p-6 rounded-xl shadow-sm border transition-colors`}>
                <h2 className="text-lg font-semibold mb-4">
                  {duzenlenenGelirId ? 'Geliri Düzenle' : `Yeni Gelir Ekle ${gelirTaslakId ? '(Taslak Oluşturuldu)' : ''}`}
                </h2>
                <form onSubmit={gelirEkle} className="space-y-4">
                  <input
                    type="text" placeholder="Gelir Kaynağı (Örn: Satış)"
                    value={gelirForm.kaynak} onChange={(e) => setGelirForm({ ...gelirForm, kaynak: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="number" placeholder="Tutar (TL)"
                    value={gelirForm.tutar} onChange={(e) => setGelirForm({ ...gelirForm, tutar: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="text" placeholder="Açıklama"
                    value={gelirForm.aciklama} onChange={(e) => setGelirForm({ ...gelirForm, aciklama: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-lg hover:bg-emerald-700 transition text-sm">
                      {duzenlenenGelirId ? 'Geliri Güncelle' : 'Geliri Kaydet & Onayla'}
                    </button>
                    {duzenlenenGelirId && (
                      <button type="button" onClick={() => { setDuzenlenenGelirId(null); setGelirForm({kaynak: '', tutar: '', aciklama: ''}); }} className={`px-4 rounded-lg text-sm ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className={`${cardBg} p-6 rounded-xl shadow-sm border transition-colors`}>
                <h2 className="text-lg font-semibold mb-4">
                  {duzenlenenGiderId ? 'Gideri Düzenle' : `Yeni Gider Ekle ${giderTaslakId ? '(Taslak Oluşturuldu)' : ''}`}
                </h2>
                <form onSubmit={giderEkle} className="space-y-4">
                  <input
                    type="text" placeholder="Kime Ödendi / Firma"
                    value={giderForm.kimeOdenecek} onChange={(e) => setGiderForm({ ...giderForm, kimeOdenecek: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <select
                    value={giderForm.kategori} onChange={(e) => setGiderForm({ ...giderForm, kategori: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  >
                    {SABIT_KATEGORILER.map((kat, idx) => (
                      <option key={idx} value={kat} className={darkMode ? 'bg-slate-900 text-white' : ''}>{kat}</option>
                    ))}
                  </select>
                  <input
                    type="number" placeholder="Tutar (TL)"
                    value={giderForm.tutar} onChange={(e) => setGiderForm({ ...giderForm, tutar: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="text" placeholder="Açıklama"
                    value={giderForm.aciklama} onChange={(e) => setGiderForm({ ...giderForm, aciklama: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm">
                      {duzenlenenGiderId ? 'Gideri Güncelle' : 'Gideri Kaydet & Onayla'}
                    </button>
                    {duzenlenenGiderId && (
                      <button type="button" onClick={() => { setDuzenlenenGiderId(null); setGiderForm({kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', aciklama: ''}); }} className={`px-4 rounded-lg text-sm ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* ARAMA VE GENEL FİLTRELEME */}
            <div className={`${cardBg} p-4 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4 transition-colors`}>
              <h2 className="text-lg font-semibold">Son İşlem Kayıtları</h2>
              <input
                type="text" placeholder="Tablolarda ara..."
                value={islemArama} onChange={(e) => setIslemArama(e.target.value)}
                className={`border ${inputBg} rounded-lg p-2 text-sm w-full md:w-72`}
              />
            </div>

            {/* GELİR LİSTESİ */}
            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4 transition-colors`}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-md font-semibold">Kasa Gelir Listesi</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Sırala:</span>
                  <select
                    value={gelirSiralama} onChange={(e) => setGelirSiralama(e.target.value)}
                    className={`border ${inputBg} rounded-lg p-1.5 text-xs outline-none cursor-pointer`}
                  >
                    <option value="yeni" className={darkMode ? 'bg-slate-900 text-white' : ''}>En Yeni Tarih</option>
                    <option value="eski" className={darkMode ? 'bg-slate-900 text-white' : ''}>En Eski Tarih</option>
                    <option value="tutar-azalan" className={darkMode ? 'bg-slate-900 text-white' : ''}>Tutar (Yüksekten Düşüğe)</option>
                    <option value="tutar-artan" className={darkMode ? 'bg-slate-900 text-white' : ''}>Tutar (Düşükten Yükseğe)</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${tableHeader} text-sm`}>
                      <th className="pb-3 font-medium">Tarih</th>
                      <th className="pb-3 font-medium">Gelir Kaynağı</th>
                      <th className="pb-3 font-medium">Açıklama</th>
                      <th className="pb-3 font-medium">Tutar</th>
                      <th className="pb-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                    {siralanmisGelirler.length === 0 ? (
                      <tr><td colSpan="5" className="py-4 text-center text-slate-500">Gelir kaydı bulunamadı.</td></tr>
                    ) : (
                      siralanmisGelirler.map((item) => (
                        <tr key={item.id} className={tableRowHover}>
                          <td className="py-3">{new Date(item.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium">{item.kaynak}</td>
                          <td className="py-3">{item.aciklama}</td>
                          <td className="py-3 font-semibold text-emerald-500">+{item.tutar.toLocaleString('tr-TR')} TL</td>
                          <td className="py-3 text-right space-x-2">
                            <button onClick={() => gelirDuzenleBaslat(item)} className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition">Düzenle</button>
                            <button onClick={() => gelirSil(item.id)} className="bg-red-500/10 text-red-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-500/20 transition">Sil</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GİDER LİSTESİ */}
            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4 transition-colors`}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-md font-semibold">Kasa Gider Listesi</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Sırala:</span>
                  <select
                    value={giderSiralama} onChange={(e) => setGiderSiralama(e.target.value)}
                    className={`border ${inputBg} rounded-lg p-1.5 text-xs outline-none cursor-pointer`}
                  >
                    <option value="yeni" className={darkMode ? 'bg-slate-900 text-white' : ''}>En Yeni Tarih</option>
                    <option value="eski" className={darkMode ? 'bg-slate-900 text-white' : ''}>En Eski Tarih</option>
                    <option value="tutar-azalan" className={darkMode ? 'bg-slate-900 text-white' : ''}>Tutar (Yüksekten Düşüğe)</option>
                    <option value="tutar-artan" className={darkMode ? 'bg-slate-900 text-white' : ''}>Tutar (Düşükten Yükseğe)</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${tableHeader} text-sm`}>
                      <th className="pb-3 font-medium">Tarih</th>
                      <th className="pb-3 font-medium">Firma / Ödenen</th>
                      <th className="pb-3 font-medium">Kategori</th>
                      <th className="pb-3 font-medium">Açıklama</th>
                      <th className="pb-3 font-medium">Tutar</th>
                      <th className="pb-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                    {siralanmisGiderler.length === 0 ? (
                      <tr><td colSpan="6" className="py-4 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
                    ) : (
                      siralanmisGiderler.map((item) => (
                        <tr key={item.id} className={tableRowHover}>
                          <td className="py-3">{new Date(item.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium">{item.kimeOdendi}</td>
                          <td className="py-3"><span className={`${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'} px-2.5 py-1 rounded-full text-xs`}>{item.kategori}</span></td>
                          <td className="py-3">{item.aciklama}</td>
                          <td className="py-3 font-semibold text-red-500">-{item.tutar.toLocaleString('tr-TR')} TL</td>
                          <td className="py-3 text-right space-x-2">
                            <button onClick={() => giderDuzenleBaslat(item)} className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition">Düzenle</button>
                            <button onClick={() => giderSil(item.id)} className="bg-red-500/10 text-red-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-500/20 transition">Sil</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TALEPLER SEKMESİ */}
        {aktifSekme === 'talepler' && (
          <div className="space-y-6">
            {girisYapanKullanici.rol === 'Personel' && (
              <div className={`${cardBg} p-6 rounded-xl shadow-sm border max-w-xl mx-auto transition-colors`}>
                <h2 className="text-lg font-semibold mb-4">Yeni Gelir/Gider Talebi Oluştur {talepTaslakId ? '(Taslak Oluşturuldu)' : ''}</h2>
                <form onSubmit={talepEkle} className="space-y-4">
                  <input
                    type="text" placeholder="Kime Ödenecek / Firma"
                    value={talepForm.kimeOdenecek} onChange={(e) => setTalepForm({ ...talepForm, kimeOdenecek: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <select
                    value={talepForm.kategori} onChange={(e) => setTalepForm({ ...talepForm, kategori: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  >
                    {SABIT_KATEGORILER.map((kat, idx) => (
                      <option key={idx} value={kat} className={darkMode ? 'bg-slate-900 text-white' : ''}>{kat}</option>
                    ))}
                  </select>
                  <input
                    type="number" placeholder="Tutar (TL)"
                    value={talepForm.tutar} onChange={(e) => setTalepForm({ ...talepForm, tutar: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="text" placeholder="Açıklama"
                    value={talepForm.aciklama} onChange={(e) => setTalepForm({ ...talepForm, aciklama: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`}
                  />
                  <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm">
                    Talep Gönder & Onayla
                  </button>
                </form>
              </div>
            )}

            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4 transition-colors`}>
              <h2 className="text-lg font-semibold">
                {girisYapanKullanici.rol === 'Personel' ? 'Gelir/Gider Taleplerimin Durumu' : 'Onay Bekleyen Gelir/Gider Talepleri'}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${tableHeader} text-sm`}>
                      <th className="pb-3 font-medium">Tarih</th>
                      <th className="pb-3 font-medium">Firma / Ödenen</th>
                      <th className="pb-3 font-medium">Kategori</th>
                      <th className="pb-3 font-medium">Tutar</th>
                      <th className="pb-3 font-medium">Durum</th>
                      {girisYapanKullanici.rol === 'Yonetici' && <th className="pb-3 font-medium text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                    {giderTalepleri.length === 0 ? (
                      <tr><td colSpan="6" className="py-4 text-center text-slate-500">Talep bulunmuyor.</td></tr>
                    ) : (
                      giderTalepleri.map((talep) => (
                        <tr key={talep.id} className={tableRowHover}>
                          <td className="py-3">{new Date(talep.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium">{talep.kimeOdenecek}</td>
                          <td className="py-3">{talep.kategori}</td>
                          <td className="py-3 font-semibold">{talep.tutar.toLocaleString('tr-TR')} TL</td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${talep.durum === 'Onaylandı' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                              {talep.durum}
                            </span>
                          </td>
                          {girisYapanKullanici.rol === 'Yonetici' && talep.durum === 'Bekliyor' && (
                            <td className="py-3 text-right">
                              <button onClick={() => talepOnayla(talep.id)} className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition">
                                Onayla & Kasaya İşle
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* RAPORLAR SEKMESİ */}
        {aktifSekme === 'raporlar' && girisYapanKullanici.rol !== 'Personel' && (
          <div className="space-y-6">
            
            {/* AKILLI ÖZET KARTI */}
            <div className={`${cardBg} p-4 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4 transition-colors`}>
              <div>
                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider">💡 Akıllı Finansal Özet</h3>
                <p className={`text-sm mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {enYuksekKategori[0] ? `Bu dönem en çok harcama yapılan kategori: ${enYuksekKategori[0]} (${enYuksekKategori[1].toLocaleString('tr-TR')} TL).` : 'Bu dönemde henüz gider kaydı bulunmuyor.'}
                  {raporToplamGelir > 0 && ` Gelirlerin gideri karşılama oranı: %${((raporToplamGelir / (raporToplamGider || 1)) * 100).toFixed(0)}.`}
                </p>
              </div>
            </div>

            {/* FİLTRELEME ÇUBUĞU */}
            <div className={`${cardBg} p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 items-center justify-between transition-colors`}>
              <input
                type="text" placeholder="Raporlarda ara..." 
                value={raporArama} onChange={(e) => setRaporArama(e.target.value)}
                className={`border ${inputBg} rounded-lg p-2 text-sm w-full md:w-64`}
              />
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <select 
                  value={raporKategori} onChange={(e) => setRaporKategori(e.target.value)}
                  className={`border ${inputBg} rounded-lg p-1.5 text-sm outline-none cursor-pointer`}
                >
                  <option value="">Tüm Kategoriler</option>
                  {SABIT_KATEGORILER.map((kat, idx) => (
                    <option key={idx} value={kat} className={darkMode ? 'bg-slate-900 text-white' : ''}>{kat}</option>
                  ))}
                </select>
                <div className={`flex items-center gap-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Başlangıç:</span>
                  <input 
                    type="date" value={raporBaslangic} onChange={(e) => setRaporBaslangic(e.target.value)}
                    className={`border ${inputBg} rounded-lg p-1.5 text-sm`}
                  />
                </div>
                <div className={`flex items-center gap-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Bitiş:</span>
                  <input 
                    type="date" value={raporBitis} onChange={(e) => setRaporBitis(e.target.value)}
                    className={`border ${inputBg} rounded-lg p-1.5 text-sm`}
                  />
                </div>
                {(raporBaslangic || raporBitis || raporArama || raporKategori) && (
                  <button 
                    onClick={() => { setRaporBaslangic(''); setRaporBitis(''); setRaporArama(''); setRaporKategori(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            </div>

            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4 transition-colors`}>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Aylık Finansal Rapor & Detaylı Günlük Görünüm</h2>
                <div className="flex gap-2">
                  <button onClick={raporlariArsivle} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Raporları Arşivle</button>
                  <button onClick={excelIndir} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition">Excel İndir</button>
                  <button onClick={pdfIndir} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 transition">PDF İndir</button>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(aylikRapor).filter(([_, veri]) => veri.detaylar.length > 0).length === 0 ? (
                  <p className="text-center text-slate-500 py-4">Belirtilen kriterlere uygun işlem kaydı bulunmuyor.</p>
                ) : (
                  Object.entries(aylikRapor)
                    .filter(([_, veri]) => veri.detaylar.length > 0)
                    .map(([ayYil, veri]) => {
                      const netDurum = veri.gelir - veri.gider;
                      const isOpen = secilenAy === ayYil;
                      const siraliDetaylar = [...veri.detaylar].sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

                      return (
                        <div key={ayYil} className={`border ${darkMode ? 'border-slate-800' : 'border-slate-200'} rounded-xl overflow-hidden shadow-sm transition`}>
                          <div 
                            onClick={() => setSecilenAy(isOpen ? null : ayYil)}
                            className={`${darkMode ? 'bg-slate-900 hover:bg-slate-850' : 'bg-slate-50 hover:bg-slate-100'} p-4 flex justify-between items-center cursor-pointer transition`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-base capitalize">{ayYil}</span>
                              <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-medium">
                                {veri.detaylar.length} İşlem
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <span className="text-emerald-500 font-semibold">Gelir: +{veri.gelir.toLocaleString('tr-TR')} TL</span>
                              <span className="text-red-500 font-semibold">Gider: -{veri.gider.toLocaleString('tr-TR')} TL</span>
                              <span className={`font-bold ${netDurum >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                Net: {netDurum.toLocaleString('tr-TR')} TL
                              </span>
                              <span className="text-slate-400 text-xs font-bold">{isOpen ? '▲ Kapat' : '▼ Detay'}</span>
                            </div>
                          </div>

                          {isOpen && (
                            <div className={`p-4 ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t border-slate-200'} space-y-4`}>
                              <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-3 rounded-lg border flex justify-between items-center text-xs text-slate-400`}>
                                <span>Rapor Dönemi: <strong className="uppercase text-slate-200">{ayYil}</strong></span>
                                <span>Toplam İşlem Hacmi: <strong className="text-slate-200">{veri.detaylar.length} adet</strong></span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className={`border-b ${tableHeader} text-xs`}>
                                      <th className="pb-2 font-medium">Tarih</th>
                                      <th className="pb-2 font-medium">İşlem Türü</th>
                                      <th className="pb-2 font-medium">Kaynak / Firma</th>
                                      <th className="pb-2 font-medium">Kategori / Açıklama</th>
                                      <th className="pb-2 font-medium text-right">Tutar</th>
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                                    {siraliDetaylar.map((item, index) => (
                                      <tr key={index} className={tableRowHover}>
                                        <td className="py-2.5 text-xs text-slate-400">{new Date(item.tarih).toLocaleDateString()}</td>
                                        <td className="py-2.5">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.tip === 'gelir' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {item.tip === 'gelir' ? 'Gelir' : 'Gider'}
                                          </span>
                                        </td>
                                        <td className="py-2.5 font-medium">{item.kaynak || item.kimeOdendi}</td>
                                        <td className="py-2.5 text-xs text-slate-400">{item.kategori ? `${item.kategori} - ${item.aciklama}` : item.aciklama}</td>
                                        <td className={`py-2.5 text-right font-semibold ${item.tip === 'gelir' ? 'text-emerald-500' : 'text-red-500'}`}>
                                          {item.tip === 'gelir' ? '+' : '-'}{item.tutar.toLocaleString('tr-TR')} TL
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* İŞLEM GEÇMİŞİ SEKMESİ */}
        {aktifSekme === 'gecmis' && girisYapanKullanici.rol !== 'Personel' && (
          <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4 transition-colors`}>
            <h2 className="text-lg font-semibold">Tüm Sistem İşlem Geçmişi (Audit Trail)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${tableHeader} text-sm`}>
                    <th className="pb-3 font-medium">Tarih</th>
                    <th className="pb-3 font-medium">İşlem Türü</th>
                    <th className="pb-3 font-medium">Detay</th>
                    <th className="pb-3 font-medium text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableDivider} text-sm`}>
                  {tumIslemGecmisi.length === 0 ? (
                    <tr><td colSpan="4" className="py-4 text-center text-slate-500">Geçmiş işlem bulunmuyor.</td></tr>
                  ) : (
                    tumIslemGecmisi.map((islem) => (
                      <tr key={islem.id} className={tableRowHover}>
                        <td className="py-3 text-xs text-slate-400">{new Date(islem.tarih).toLocaleString('tr-TR')}</td>
                        <td className="py-3 font-medium">{islem.tur}</td>
                        <td className="py-3 text-sm">{islem.aciklama}</td>
                        <td className={`py-3 text-right font-semibold ${islem.tip === 'gelir' ? 'text-emerald-500' : islem.tip === 'gider' ? 'text-red-500' : 'text-amber-500'}`}>
                          {islem.tip === 'gelir' ? '+' : islem.tip === 'gider' ? '-' : ''}{islem.tutar.toLocaleString('tr-TR')} TL
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* KULLANICI YÖNETİMİ SEKMESİ */}
        {aktifSekme === 'kullanicilar' && girisYapanKullanici.rol === 'Yonetici' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`${cardBg} p-6 rounded-xl shadow-sm border h-fit space-y-6 transition-colors`}>
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  {duzenlenenKullaniciId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}
                </h2>
                <form onSubmit={kullaniciKaydetVeyaGuncelle} className="space-y-4">
                  <input
                    type="text" placeholder="Ad Soyad"
                    value={yeniKullaniciForm.adSoyad} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, adSoyad: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="text" placeholder="Kullanıcı Adı"
                    value={yeniKullaniciForm.kullaniciAdi} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, kullaniciAdi: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="password" placeholder={duzenlenenKullaniciId ? "Şifre (Değiştirmeyecekseniz boş bırakın)" : "Şifre"}
                    value={yeniKullaniciForm.sifre} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, sifre: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} {...(!duzenlenenKullaniciId && { required: true })}
                  />
                  <select
                    value={yeniKullaniciForm.rol} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, rol: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`}
                  >
                    <option value="Yonetici" className={darkMode ? 'bg-slate-900 text-white' : ''}>Yönetici</option>
                    <option value="Muhasebe" className={darkMode ? 'bg-slate-900 text-white' : ''}>Muhasebe</option>
                    <option value="Personel" className={darkMode ? 'bg-slate-900 text-white' : ''}>Personel</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm">
                      {duzenlenenKullaniciId ? 'Kullanıcıyı Güncelle' : 'Kullanıcıyı Kaydet'}
                    </button>
                    {duzenlenenKullaniciId && (
                      <button 
                        type="button" 
                        onClick={() => { 
                          setDuzenlenenKullaniciId(null); 
                          setYeniKullaniciForm({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' }); 
                        }} 
                        className={`px-4 rounded-lg text-sm ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                      >
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <hr className={`${darkMode ? 'border-slate-800' : 'border-slate-100'}`} />

              <div>
                <h2 className="text-lg font-semibold mb-4">Şifremi Güncelle</h2>
                <form onSubmit={sifreGuncelle} className="space-y-4">
                  <input
                    type="password" placeholder="Yeni Şifre"
                    value={sifreForm.yeniSifre} onChange={(e) => setSifreForm({ ...sifreForm, yeniSifre: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <input
                    type="password" placeholder="Yeni Şifre (Tekrar)"
                    value={sifreForm.yeniSifreTekrar} onChange={(e) => setSifreForm({ ...sifreForm, yeniSifreTekrar: e.target.value })}
                    className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required
                  />
                  <button type="submit" className={`w-full ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-800 hover:bg-slate-900'} text-white font-medium py-2.5 rounded-lg transition text-sm`}>
                    Şifreyi Değiştir
                  </button>
                </form>
              </div>
            </div>

            <div className={`${cardBg} md:col-span-2 p-6 rounded-xl shadow-sm border space-y-4 transition-colors`}>
              <h2 className="text-lg font-semibold">Sistem Kullanıcıları</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${tableHeader} text-sm`}>
                      <th className="pb-3 font-medium">Ad Soyad</th>
                      <th className="pb-3 font-medium">Kullanıcı Adı</th>
                      <th className="pb-3 font-medium">Rol</th>
                      <th className="pb-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                    {kullanicilar.map((kul) => (
                      <tr key={kul.id} className={tableRowHover}>
                        <td className="py-3 font-medium">{kul.adSoyad}</td>
                        <td className="py-3">{kul.kullaniciAdi}</td>
                        <td className="py-3">
                          <span className={`${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'} px-2.5 py-1 rounded-full text-xs font-medium`}>
                            {kul.rol}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button onClick={() => kullaniciDuzenleBaslat(kul)} className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition">Düzenle</button>
                          <button onClick={() => kullaniciSil(kul.id)} className="bg-red-500/10 text-red-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-500/20 transition">Sil</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App