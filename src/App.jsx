import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { Toaster, toast } from 'react-hot-toast'
import Tesseract from 'tesseract.js' // OCR (Fiş okuma) için eklendi

const API_URL = "https://kasa-takip-byfabric.onrender.com/api"; 

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

  // --- DİNAMİK KATEGORİ LİSTESİ ---
  const [kategoriler, setKategoriler] = useState(() => {
    const saved = localStorage.getItem('kasa_kategoriler');
    return saved ? JSON.parse(saved) : [
      'Fatura (Elektrik, Su, Doğalgaz, İnternet)',
      'Kira',
      'Ofis Malzemeleri',
      'Ulaşım ve Akaryakıt',
      'Maaş ve Personel',
      'Yemek ve İkram',
      'Bakım ve Onarım',
      'Diğer'
    ];
  });
  const [yeniKategoriAdi, setYeniKategoriAdi] = useState('');

  useEffect(() => {
    localStorage.setItem('kasa_kategoriler', JSON.stringify(kategoriler));
  }, [kategoriler]);

  // --- ŞİFRE GÜNCELLEME STATE'İ ---
  const [sifreForm, setSifreForm] = useState({ yeniSifre: '', yeniSifreTekrar: '' });

  // --- YEREL DEPOLAMA DESTEKLİ LİSTELER ---
  const [giderler, setGiderler] = useState(() => {
    const saved = localStorage.getItem('kasa_giderler');
    return saved ? JSON.parse(saved) : [];
  });
  const [gelirler, setGelirler] = useState(() => {
    const saved = localStorage.getItem('kasa_gelirler');
    return saved ? JSON.parse(saved) : [];
  });
  const [kullanicilar, setKullanicilar] = useState(() => {
    const saved = localStorage.getItem('kasa_kullanicilar');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('kasa_giderler', JSON.stringify(giderler));
  }, [giderler]);

  useEffect(() => {
    localStorage.setItem('kasa_gelirler', JSON.stringify(gelirler));
  }, [gelirler]);

  useEffect(() => {
    localStorage.setItem('kasa_kullanicilar', JSON.stringify(kullanicilar));
  }, [kullanicilar]);

  const [arşivRaporlar, setArşivRaporlar] = useState([]);
  const [giderTalepleri, setGiderTalepleri] = useState([]);

  // --- DÜZENLEME STATE'LERİ ---
  const [duzenlenenGelirId, setDuzenlenenGelirId] = useState(null);
  const [duzenlenenGiderId, setDuzenlenenGiderId] = useState(null);
  const [duzenlenenKullaniciId, setDuzenlenenKullaniciId] = useState(null);

  // --- İŞLEMLER SEKME ARAMASI VE TEK TABLO SIRALAMA ---
  const [islemArama, setIslemArama] = useState('');
  const [kasaSiralama, setKasaSiralama] = useState('yeni');

  // --- RAPORLAR FİLTRELEME VE AKORDİYON STATE'LERİ ---
  const [raporArama, setRaporArama] = useState('');
  const [raporBaslangic, setRaporBaslangic] = useState('');
  const [raporBitis, setRaporBitis] = useState('');
  const [raporKategori, setRaporKategori] = useState('');
  const [secilenAy, setSecilenAy] = useState(null);
  const [secilenGun, setSecilenGun] = useState(null);

  // --- FORM STATE'LERİ & KDV ORANI ---
  const [giderForm, setGiderForm] = useState(() => {
    const saved = localStorage.getItem('kasa_giderForm');
    return saved ? JSON.parse(saved) : { kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', kdvOrani: '20', aciklama: '' };
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
    return saved ? JSON.parse(saved) : { kimeOdenecek: '', kategori: 'Fatura (Elektrik, Su, Doğalgaz, İnternet)', tutar: '', kdvOrani: '20', aciklama: '' };
  });
  const [talepTaslakId, setTalepTaslakId] = useState(() => {
    const savedId = localStorage.getItem('kasa_talepTaslakId');
    return savedId ? parseInt(savedId) : null;
  });

  const [yeniKullaniciForm, setYeniKullaniciForm] = useState({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
  
  // ROL BAZLI DİNAMİK BAŞLANGIÇ SEKMESİ
  const [aktifSekme, setAktifSekme] = useState(() => {
    const savedUser = localStorage.getItem('kasa_girisYapanKullanici');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        return user.rol === 'Personel' ? 'talepler' : 'islemler';
      } catch (e) {
        return 'islemler';
      }
    }
    return 'islemler';
  });

  // --- LOCAL STORAGE YEDEKLEMELERİ ---
  useEffect(() => localStorage.setItem('kasa_giderForm', JSON.stringify(giderForm)), [giderForm]);
  useEffect(() => localStorage.setItem('kasa_gelirForm', JSON.stringify(gelirForm)), [gelirForm]);
  useEffect(() => localStorage.setItem('kasa_talepForm', JSON.stringify(talepForm)), [talepForm]);

  // ==========================================
  // KDV HESAPLAMA YARDIMCISI
  // ==========================================
  const kdvHesaplaMetni = (tutarStr, oranStr) => {
    const tutar = parseFloat(tutarStr) || 0;
    const oran = parseFloat(oranStr) || 0;
    if (tutar <= 0 || oran === 0) return '';
    const kdvTutar = (tutar * (oran / 100)).toFixed(2);
    return `KDV: %${oran} (${kdvTutar} TL)`;
  };

  const anlikKdvHesapla = (tutarStr, oranStr) => {
    const tutar = parseFloat(tutarStr) || 0;
    const oran = parseFloat(oranStr) || 0;
    if (tutar <= 0 || oran === 0) return '0.00 TL';
    return (tutar * (oran / 100)).toFixed(2) + ' TL';
  };

  // ==========================================
  // 1. GİDER İÇİN OTOMATİK KAYIT (AUTO-SAVE)
  // ==========================================
  useEffect(() => {
    if (!girisYapanKullanici || girisYapanKullanici.rol === 'Personel') return;
    if (duzenlenenGiderId) return; 
    if (!giderForm.kimeOdenecek && !giderForm.tutar && !giderForm.kategori && !giderForm.aciklama) return;

    const timer = setTimeout(async () => {
      const userRol = girisYapanKullanici.rol;
      const kdvText = kdvHesaplaMetni(giderForm.tutar, giderForm.kdvOrani);
      const nihaiAciklama = kdvText ? `${giderForm.aciklama} | ${kdvText}` : giderForm.aciklama;

      if (giderTaslakId) {
        try {
          await fetch(`${API_URL}/Gider/${giderTaslakId}?rol=${userRol}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kimeOdendi: giderForm.kimeOdenecek || '-',
              kategori: giderForm.kategori || 'Diğer',
              tutar: parseFloat(giderForm.tutar) || 0,
              aciklama: nihaiAciklama || 'Taslak Kayıt',
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
                aciklama: nihaiAciklama || 'Taslak Kayıt',
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
  // SÜPER AKILLI FİŞ OKUTMA
  // ==========================================
  const fisOkutGenel = async (e, hedefForm, setHedefForm) => {
    const dosya = e.target.files[0];
    if (!dosya) return;

    const toastId = toast.loading("📸 Fiş yapay zeka ile taranıyor...");
    
    try {
      const { data: { text } } = await Tesseract.recognize(dosya, 'tur', {
        logger: m => {} 
      });

      const satirlar = text.split('\n').map(s => s.trim()).filter(s => s.length > 2);
      const textUpper = text.toUpperCase();

      let tahminEdilenKategori = hedefForm.kategori || 'Diğer';
      let fisTuruAciklamasi = 'Genel Fiş Alışverişi';

      const ulasimKelimeleri = ['BENZİN', 'MOTORİN', 'LPG', 'AKARYAKIT', 'PETROL', 'OPET', 'SHELL', 'TOTAL', 'AYGAZ', 'BP', 'LUKOIL', 'OTOBÜS', 'BİLET', 'ULAŞIM', 'SEYAHAT', 'ULAŞTIRMA', 'TAKSİ', 'METRO', 'TREN', 'YOLCU'];
      const yemekKelimeleri = ['RESTORAN', 'CAFE', 'KAFE', 'LOKANTA', 'DÖNER', 'KEBAP', 'PİDE', 'MARKET', 'GIDA', 'BÜFE', 'MİGROS', 'BİM', 'ŞOK', 'A101', 'CARREFOUR', 'YEMEK'];
      const ofisKelimeleri = ['KIRTASİYE', 'A4', 'KAĞIT', 'KALEM', 'TEKNOLOJİ', 'BİLGİSAYAR', 'OFİS'];
      const faturaKelimeleri = ['ELEKTRİK', 'SU İDARESİ', 'İGDAŞ', 'TURKCELL', 'VODAFONE', 'TÜRK TELEKOM', 'İNTERNET', 'FATURA'];
      const bakimKelimeleri = ['SERVİS', 'OTO TAMİR', 'BAKIM', 'ONARIM', 'YEDEK PARÇA', 'USTA'];

      if (ulasimKelimeleri.some(k => textUpper.includes(k))) {
          tahminEdilenKategori = 'Ulaşım ve Akaryakıt';
          fisTuruAciklamasi = 'Ulaşım / Akaryakıt Fişi';
      } else if (yemekKelimeleri.some(k => textUpper.includes(k))) {
          tahminEdilenKategori = 'Yemek ve İkram';
          fisTuruAciklamasi = 'Yemek / Market Fişi';
      } else if (ofisKelimeleri.some(k => textUpper.includes(k))) {
          tahminEdilenKategori = 'Ofis Malzemeleri';
          fisTuruAciklamasi = 'Ofis / Kırtasiye Fişi';
      } else if (faturaKelimeleri.some(k => textUpper.includes(k))) {
          tahminEdilenKategori = 'Fatura (Elektrik, Su, Doğalgaz, İnternet)';
          fisTuruAciklamasi = 'Kurum Faturası';
      } else if (bakimKelimeleri.some(k => textUpper.includes(k))) {
          tahminEdilenKategori = 'Bakım ve Onarım';
          fisTuruAciklamasi = 'Bakım ve Onarım Fişi';
      }

      let firmaAdi = '';
      const resmiFirmaSatiri = satirlar.find(s => {
          const u = s.toUpperCase();
          return u.includes('A.Ş') || u.includes('LTD') || u.includes('TİC') || u.includes('SAN') || u.includes('MARKET') || u.includes('PETROL') || u.includes('TURİZM');
      });

      if (resmiFirmaSatiri) {
          firmaAdi = resmiFirmaSatiri;
      } else {
          const temizSatirlar = satirlar.filter(s => {
              const harfSayisi = (s.match(/[a-zA-ZğüşöçİĞÜŞÖÇ]/g) || []).length;
              const ozelKarakterSayisi = (s.match(/[^a-zA-ZğüşöçİĞÜŞÖÇ0-9\s.,]/g) || []).length;
              return harfSayisi > 3 && ozelKarakterSayisi < 3;
          });
          firmaAdi = temizSatirlar.length > 0 ? temizSatirlar[0] : '';
      }
      firmaAdi = firmaAdi.replace(/[^a-zA-ZğüşöçİĞÜŞÖÇ0-9\s.,-]/g, '').substring(0, 40).trim();

      const tarihMatch = text.match(/\b(\d{2}[./-]\d{2}[./-]\d{4}|\d{2}[./-]\d{2}[./-]\d{2})\b/);
      const fisTarihiStr = tarihMatch ? `Tarih: ${tarihMatch[1]}` : '';

      let bulunanTutar = '';
      const tutarArama = text.match(/(?:TOP|TUTAR|TOPLAM|KDV DAH[Iİ]L|NAK[Iİ]T|KRED[Iİ])\s*[:=.\-]?\s*[*]?\s*(\d+[.,]\d{2})/i);

      if (tutarArama && tutarArama[1]) {
        bulunanTutar = tutarArama[1].replace(',', '.');
      } else {
        const tumFiyatlar = text.match(/\d+[.,]\d{2}/g);
        if (tumFiyatlar && tumFiyatlar.length > 0) {
          const sayiDegerleri = tumFiyatlar.map(s => parseFloat(s.replace(',', '.')));
          bulunanTutar = Math.max(...sayiDegerleri).toString();
        }
      }

      let tespitEdilenKdvOrani = '0';
      const kdvOranMatch = text.match(/(?:KDV\s*1?O?R?A?N?I?|%)\s*(\d+([.,]\d+)?)/i);
      const kdvTutarRegex = text.match(/(?:KDV|TOPLAM KDV|HESAPLANAN KDV)\s*[:=.\-]?\s*(\d+[.,]\d{2})/i);

      if (kdvOranMatch && kdvOranMatch[1]) {
          tespitEdilenKdvOrani = kdvOranMatch[1].replace(',', '.');
      } else if (kdvTutarRegex && kdvTutarRegex[1] && bulunanTutar) {
          const kdvTutarNum = parseFloat(kdvTutarRegex[1].replace(',', '.'));
          const toplamTutarNum = parseFloat(bulunanTutar);
          if (toplamTutarNum > kdvTutarNum && kdvTutarNum > 0) {
              const matrah = toplamTutarNum - kdvTutarNum;
              tespitEdilenKdvOrani = ((kdvTutarNum / matrah) * 100).toFixed(2);
          }
      }

      setHedefForm({
        ...hedefForm,
        kimeOdenecek: firmaAdi || 'Okunamadı',
        tutar: bulunanTutar,
        kategori: tahminEdilenKategori,
        kdvOrani: tespitEdilenKdvOrani,
        aciklama: fisTarihiStr ? `${fisTuruAciklamasi} | ${fisTarihiStr}` : fisTuruAciklamasi,
      });

      toast.success("Fiş başarıyla okundu!", { id: toastId });
    } catch (error) {
      console.error("OCR Hatası:", error);
      toast.error("Fiş okunamadı.", { id: toastId });
    }
  };

  const fisOkut = (e) => fisOkutGenel(e, giderForm, setGiderForm);

  // --- KORUMALI VERİ ÇEKME ---
  const verileriGetir = async () => {
    try {
      const giderRes = await fetch(`${API_URL}/Gider`);
      const gelirRes = await fetch(`${API_URL}/Gelir`);
      const raporRes = await fetch(`${API_URL}/AylikRapor`);
      const talepRes = await fetch(`${API_URL}/GiderTalebi`);
      const kulRes = await fetch(`${API_URL}/Kullanici`);
      
      if (giderRes.ok) {
        const data = await giderRes.json();
        if (data && data.length > 0) setGiderler(data);
      }
      if (gelirRes.ok) {
        const data = await gelirRes.json();
        if (data && data.length > 0) setGelirler(data);
      }
      if (raporRes.ok) {
        const data = await raporRes.json();
        if (data && data.length > 0) setArşivRaporlar(data);
      }
      if (talepRes.ok) {
        const data = await talepRes.json();
        if (data) setGiderTalepleri(data);
      }
      if (kulRes.ok) {
        const data = await kulRes.json();
        if (data && data.length > 0) setKullanicilar(data);
      }
    } catch (error) { 
      console.error("Veri çekme hatası:", error); 
    }
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
      toast.error("Sunucu bağlantı hatası.");
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

  const sifreGuncelle = async (e) => {
    e.preventDefault();
    if (!sifreForm.yeniSifre) return toast.error("Yeni şifre giriniz.");
    if (sifreForm.yeniSifre !== sifreForm.yeniSifreTekrar) return toast.error("Şifreler uyuşmuyor!");

    try {
      const response = await fetch(`${API_URL}/Kullanici/${girisYapanKullanici.id}/sifre`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sifre: sifreForm.yeniSifre })
      });
      if (response.ok) {
        toast.success("Şifreniz güncellendi.");
        setSifreForm({ yeniSifre: '', yeniSifreTekrar: '' });
      } else {
        toast.error("Şifre güncellenemedi.");
      }
    } catch (error) {
      toast.error("Bağlantı hatası.");
    }
  };

  const kullaniciKaydetVeyaGuncelle = async (e) => {
    e.preventDefault();
    try {
      const gonderilecekVeri = { ...yeniKullaniciForm };
      if (!gonderilecekVeri.sifre) delete gonderilecekVeri.sifre;

      if (duzenlenenKullaniciId) {
        gonderilecekVeri.id = duzenlenenKullaniciId;
        const response = await fetch(`${API_URL}/Kullanici/${duzenlenenKullaniciId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gonderilecekVeri)
        });
        if (response.ok) {
          toast.success("Kullanıcı güncellendi.");
          setDuzenlenenKullaniciId(null);
          setYeniKullaniciForm({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
          verileriGetir();
        } else {
          toast.error("Kullanıcı güncellenemedi.");
        }
      } else {
        const response = await fetch(`${API_URL}/Kullanici`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(yeniKullaniciForm)
        });
        if (response.ok) {
          setYeniKullaniciForm({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
          verileriGetir();
          toast.success("Kullanıcı eklendi.");
        } else {
          toast.error("Kullanıcı eklenemedi.");
        }
      }
    } catch (error) {
      toast.error("İşlem hatası.");
    }
  };

  const kullaniciDuzenleBaslat = (kul) => {
    setDuzenlenenKullaniciId(kul.id);
    setYeniKullaniciForm({ id: kul.id, adSoyad: kul.adSoyad, kullaniciAdi: kul.kullaniciAdi, sifre: '', rol: kul.rol });
  };

  const kullaniciSil = async (id) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`${API_URL}/Kullanici/${id}`, { method: 'DELETE' });
      if (response.ok) {
        verileriGetir();
        toast.success("Kullanıcı silindi.");
      } else {
        toast.error("Silinemedi.");
      }
    } catch (error) {
      toast.error("Hata oluştu.");
    }
  };

  const yeniKategoriEkle = (e) => {
    e.preventDefault();
    if (!yeniKategoriAdi.trim()) return;
    if (kategoriler.includes(yeniKategoriAdi.trim())) return toast.error("Zaten var!");
    setKategoriler([...kategoriler, yeniKategoriAdi.trim()]);
    toast.success("Kategori eklendi.");
    setYeniKategoriAdi('');
  };

  const kategoriSil = (kat) => {
    if (kategoriler.length <= 1) return toast.error("En az bir kategori kalmalı.");
    if (!window.confirm(`"${kat}" silinsin mi?`)) return;
    setKategoriler(kategoriler.filter(k => k !== kat));
    toast.success("Silindi.");
  };

  const giderEkle = async (e) => {
    e.preventDefault();
    if (!giderForm.kimeOdenecek || !giderForm.tutar) return;

    try {
      const userRol = girisYapanKullanici ? girisYapanKullanici.rol : '';
      const kdvText = kdvHesaplaMetni(giderForm.tutar, giderForm.kdvOrani);
      const nihaiAciklama = kdvText ? `${giderForm.aciklama} | ${kdvText}` : giderForm.aciklama;

      if (duzenlenenGiderId) {
        await fetch(`${API_URL}/Gider/${duzenlenenGiderId}?rol=${userRol}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori || 'Diğer',
            tutar: parseFloat(giderForm.tutar), aciklama: nihaiAciklama,
            tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
          })
        });
        setDuzenlenenGiderId(null);
        toast.success("Gider güncellendi.");
      } else {
        await fetch(`${API_URL}/Gider`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori || 'Diğer',
            tutar: parseFloat(giderForm.tutar), aciklama: nihaiAciklama,
            tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
          })
        });
        toast.success("Gider eklendi.");
      }
      setGiderForm({ kimeOdenecek: '', kategori: kategoriler[0], tutar: '', kdvOrani: '20', aciklama: '' });
      verileriGetir();
    } catch (error) { 
      toast.error("İşlem başarısız.");
    }
  };

  const giderDuzenleBaslat = (item) => {
    setDuzenlenenGiderId(item.id);
    setGiderForm({ kimeOdenecek: item.kimeOdendi, kategori: item.kategori || 'Diğer', tutar: item.tutar, kdvOrani: '20', aciklama: item.aciklama || '' });
  };

  const giderSil = async (id) => {
    if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
    try {
      const userRol = girisYapanKullanici ? girisYapanKullanici.rol : '';
      const response = await fetch(`${API_URL}/Gider/${id}?rol=${userRol}`, { method: 'DELETE' });
      if (response.ok) {
        verileriGetir();
        toast.success("Silindi.");
      } else {
        toast.error("Yetkiniz yok.");
      }
    } catch (error) { 
      toast.error("Silme başarısız.");
    }
  };

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
        toast.success("Gelir güncellendi.");
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
      setGelirForm({ kaynak: '', tutar: '', aciklama: '' });
      verileriGetir();
    } catch (error) { 
      toast.error("İşlem başarısız.");
    }
  };

  const gelirDuzenleBaslat = (item) => {
    setDuzenlenenGelirId(item.id);
    setGelirForm({ kaynak: item.kaynak, tutar: item.tutar, aciklama: item.aciklama || '' });
  };

  const gelirSil = async (id) => {
    if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`${API_URL}/Gelir/${id}`, { method: 'DELETE' });
      if (response.ok) {
        verileriGetir();
        toast.success("Gelir silindi.");
      } else {
        toast.error("Silinemedi.");
      }
    } catch (error) { 
      toast.error("Silme başarısız.");
    }
  };

  // --- TALEP EKLE ---
  const talepEkle = async (e) => {
    e.preventDefault();
    if (!talepForm.kimeOdenecek || !talepForm.tutar) return;

    try {
      const kdvText = kdvHesaplaMetni(talepForm.tutar, talepForm.kdvOrani);
      const nihaiAciklama = kdvText ? `${talepForm.aciklama} | ${kdvText}` : talepForm.aciklama;

      await fetch(`${API_URL}/GiderTalebi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talepEdenPersonelId: girisYapanKullanici.id,
          kimeOdenecek: talepForm.kimeOdenecek, 
          kategori: talepForm.kategori || 'Diğer',
          tutar: parseFloat(talepForm.tutar), 
          aciklama: nihaiAciklama,
          tarih: new Date().toISOString(),
          durum: "Bekliyor"
        })
      });

      setTalepForm({ kimeOdenecek: '', kategori: kategoriler[0], tutar: '', kdvOrani: '20', aciklama: '' });
      localStorage.removeItem('kasa_talepForm');
      verileriGetir();
      toast.success("Talep başarıyla oluşturuldu ve onaya gönderildi.");
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
      } else {
        toast.error("Talep onaylanamadı.");
      }
    } catch (error) { 
      toast.error("Onaylama başarısız.");
    }
  };

  const talepReddet = async (id) => {
    if (!window.confirm("Bu talebi reddetmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`${API_URL}/GiderTalebi/${id}/reddet`, { method: 'PUT' });
      if (response.ok) {
        verileriGetir();
        toast.success("Talep reddedildi.");
      } else {
        toast.error("Talep reddedilemedi.");
      }
    } catch (error) {
      toast.error("Reddetme başarısız.");
    }
  };

  const bugunMu = (tarihStr) => {
    if (!tarihStr) return false;
    const d = new Date(tarihStr);
    const bugun = new Date();
    return d.getDate() === bugun.getDate() &&
           d.getMonth() === bugun.getMonth() &&
           d.getFullYear() === bugun.getFullYear();
  };

  const tumKasaListesi = [
    ...gelirler.map(g => ({
      id: `gelir-${g.id}`, gercekId: g.id, tip: 'gelir', tarih: g.tarih,
      isimVeyaKaynak: g.kaynak, kategori: '-', aciklama: g.aciklama, tutar: g.tutar, orijinalVeri: g
    })),
    ...giderler.map(gi => ({
      id: `gider-${gi.id}`, gercekId: gi.id, tip: 'gider', tarih: gi.tarih,
      isimVeyaKaynak: gi.kimeOdendi, kategori: gi.kategori || 'Diğer', aciklama: gi.aciklama, tutar: gi.tutar, orijinalVeri: gi
    }))
  ].filter(item => bugunMu(item.tarih));

  const filtrelenmisKasaListesi = tumKasaListesi.filter(item => 
    (item.isimVeyaKaynak || '').toLowerCase().includes(islemArama.toLowerCase()) ||
    (item.kategori || '').toLowerCase().includes(islemArama.toLowerCase()) ||
    (item.aciklama || '').toLowerCase().includes(islemArama.toLowerCase())
  );

  const siralanmisKasaListesi = [...filtrelenmisKasaListesi].sort((a, b) => {
    if (kasaSiralama === 'yeni') return new Date(b.tarih) - new Date(a.tarih);
    if (kasaSiralama === 'eski') return new Date(a.tarih) - new Date(b.tarih);
    if (kasaSiralama === 'tutar-azalan') return b.tutar - a.tutar;
    if (kasaSiralama === 'tutar-artan') return a.tutar - b.tutar;
    return 0;
  });

  const tumIslemGecmisi = [
    ...gelirler.map(g => ({ id: `gelir-${g.id}`, tur: 'Gelir Ekleme', aciklama: `${g.kaynak} - ${g.aciklama || '-'}`, tutar: g.tutar, tip: 'gelir', tarih: g.tarih })),
    ...giderler.map(gi => ({ id: `gider-${gi.id}`, tur: 'Gider Ekleme', aciklama: `${gi.kimeOdendi} (${gi.kategori}) - ${gi.aciklama || '-'}`, tutar: gi.tutar, tip: 'gider', tarih: gi.tarih })),
    ...giderTalepleri.map(t => ({ id: `talep-${t.id}`, tur: `Talep (${t.durum})`, aciklama: `${t.kimeOdenecek} (${t.kategori}) - ${t.aciklama || '-'}`, tutar: t.tutar, tip: 'talep', tarih: t.tarih }))
  ].sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

  const raporTarihFiltresi = (tarih) => {
    if (!raporBaslangic && !raporBitis) return true;
    const itemDate = new Date(tarih).toISOString().split('T')[0];
    if (raporBaslangic && itemDate < raporBaslangic) return false;
    if (raporBitis && itemDate > raporBitis) return false;
    return true;
  };

  const raporIcinGelirler = gelirler.filter(item => (item.kaynak || '').toLowerCase().includes(raporArama.toLowerCase()) && raporTarihFiltresi(item.tarih));
  const raporIcinGiderler = giderler.filter(item => {
    const metinUyumu = (item.kimeOdendi || '').toLowerCase().includes(raporArama.toLowerCase()) || (item.kategori || '').toLowerCase().includes(raporArama.toLowerCase());
    const kategoriUyumu = raporKategori ? item.kategori === raporKategori : true;
    return metinUyumu && raporTarihFiltresi(item.tarih) && kategoriUyumu;
  });

  const raporToplamGelir = raporIcinGelirler.reduce((acc, i) => acc + i.tutar, 0);
  const raporToplamGider = raporIcinGiderler.reduce((acc, i) => acc + i.tutar, 0);
  const kategoriHarcamalari = raporIcinGiderler.reduce((acc, item) => {
    const cat = item.kategori || 'Diğer';
    acc[cat] = (acc[cat] || 0) + item.tutar;
    return acc;
  }, {});
  const enYuksekKategori = Object.entries(kategoriHarcamalari).reduce((max, curr) => curr[1] > (max[1] || 0) ? curr : max, [null, 0]);

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
      toast.success("Raporlar arşivlendi!");
    } catch (error) { 
      toast.error("Arşivleme başarısız.");
    }
  };

  const excelIndir = () => {
    const veriDizisi = [];
    raporIcinGelirler.forEach(item => veriDizisi.push({ "Tarih": new Date(item.tarih).toLocaleDateString('tr-TR'), "Tür": "Gelir", "Kaynak": item.kaynak, "Kategori": "-", "Açıklama": item.aciklama || "-", "Tutar": item.tutar }));
    raporIcinGiderler.forEach(item => veriDizisi.push({ "Tarih": new Date(item.tarih).toLocaleDateString('tr-TR'), "Tür": "Gider", "Kaynak": item.kimeOdendi, "Kategori": item.kategori, "Açıklama": item.aciklama || "-", "Tutar": item.tutar }));
    if (veriDizisi.length === 0) return toast.error("Veri yok.");
    const worksheet = XLSX.utils.json_to_sheet(veriDizisi);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rapor");
    XLSX.writeFile(workbook, "Rapor.xlsx");
    toast.success("Excel indirildi.");
  };

  const pdfIndir = () => {
    const doc = new jsPDF();
    doc.text("Kasa Takip - Rapor", 14, 15);
    const tableColumn = ["Ay", "Gelir", "Gider", "Net"];
    const tableRows = [];
    Object.entries(aylikRapor).forEach(([ay, veri]) => {
      tableRows.push([ay, `${veri.gelir} TL`, `${veri.gider} TL`, `${veri.gelir - veri.gider} TL`]);
    });
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 25 });
    doc.save("Rapor.pdf");
    toast.success("PDF indirildi.");
  };

  if (!girisYapanKullanici) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-white'} flex items-center justify-center p-6 transition-colors`}>
        <Toaster position="top-right" />
        <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6`}>
          <div className="text-center space-y-2">
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Kasa Takip Sistemi</h1>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Giriş Yapın</p>
          </div>
          <form onSubmit={girisYap} className="space-y-4">
            <div>
              <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-1`}>Kullanıcı Adı</label>
              <input
                type="text" value={loginForm.kullaniciAdi}
                onChange={(e) => setLoginForm({ ...loginForm, kullaniciAdi: e.target.value })}
                className={`w-full border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-lg p-3 text-sm focus:outline-none`}
                required
              />
            </div>
            <div>
              <label className={`block text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-1`}>Şifre</label>
              <input
                type="password" value={loginForm.sifre}
                onChange={(e) => setLoginForm({ ...loginForm, sifre: e.target.value })}
                className={`w-full border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} rounded-lg p-3 text-sm focus:outline-none`}
                required
              />
            </div>
            <button 
              type="submit" disabled={yukleniyor}
              className={`w-full text-white font-medium py-3 rounded-lg transition text-sm ${yukleniyor ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {yukleniyor ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const cardBg = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800';
  const tableHeader = darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-400';
  const tableRowHover = darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50';
  const tableDivider = darkMode ? 'divide-slate-800 text-slate-300' : 'divide-slate-50 text-slate-600';

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} p-6 transition-colors`}>
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ÜST BİLGİ */}
        <div className={`flex justify-between items-center ${cardBg} p-4 rounded-xl shadow-sm border`}>
          <div>
            <h1 className="text-xl font-bold">Kasa Takip Sistemi</h1>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Hoş geldiniz, <span className="font-semibold">{girisYapanKullanici.adSoyad}</span> ({girisYapanKullanici.rol})</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className={`px-3 py-2 rounded-lg text-xs font-medium ${darkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-600'}`}>
              {darkMode ? '☀️ Aydınlık' : '🌙 Karanlık'}
            </button>
            <button onClick={cikisYap} className={`px-4 py-2 rounded-lg text-xs font-medium ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              Çıkış
            </button>
          </div>
        </div>

        {/* SEKMELER */}
        <div className={`flex items-center flex-wrap gap-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} pb-3`}>
          {girisYapanKullanici.rol !== 'Personel' && (
            <button onClick={() => setAktifSekme('islemler')} className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'islemler' ? 'bg-blue-600 text-white' : cardBg}`}>
              Kasa Yönetimi
            </button>
          )}
          <button onClick={() => setAktifSekme('talepler')} className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'talepler' ? 'bg-blue-600 text-white' : cardBg}`}>
            {girisYapanKullanici.rol === 'Personel' ? 'Talep & Fiş Okutma' : 'Talep Onayları'}
          </button>
          {girisYapanKullanici.rol !== 'Personel' && (
            <>
              <button onClick={() => setAktifSekme('raporlar')} className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'raporlar' ? 'bg-blue-600 text-white' : cardBg}`}>Raporlar</button>
              <button onClick={() => setAktifSekme('gecmis')} className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'gecmis' ? 'bg-blue-600 text-white' : cardBg}`}>Geçmiş</button>
            </>
          )}
          {girisYapanKullanici.rol === 'Yonetici' && (
            <button onClick={() => setAktifSekme('kullanicilar')} className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'kullanicilar' ? 'bg-blue-600 text-white' : cardBg}`}>Yönetim</button>
          )}
        </div>

        {/* KASA ÖZETİ */}
        {girisYapanKullanici.rol !== 'Personel' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardBg} p-5 rounded-xl shadow-sm border`}>
              <p className="text-sm font-medium text-slate-400">Toplam Gelir</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{toplamGelir.toLocaleString('tr-TR')} TL</h3>
            </div>
            <div className={`${cardBg} p-5 rounded-xl shadow-sm border`}>
              <p className="text-sm font-medium text-slate-400">Toplam Gider</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{toplamGider.toLocaleString('tr-TR')} TL</h3>
            </div>
            <div className={`${cardBg} p-5 rounded-xl shadow-sm border`}>
              <p className="text-sm font-medium text-slate-400">Net Bakiye</p>
              <h3 className={`text-2xl font-bold mt-1 ${netBakiye >= 0 ? 'text-blue-500' : 'text-red-600'}`}>{netBakiye.toLocaleString('tr-TR')} TL</h3>
            </div>
          </div>
        )}

        {/* İŞLEMLER SEKMESİ */}
        {aktifSekme === 'islemler' && girisYapanKullanici.rol !== 'Personel' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`${cardBg} p-6 rounded-xl shadow-sm border`}>
                <h2 className="text-lg font-semibold mb-4">{duzenlenenGelirId ? 'Geliri Düzenle' : 'Yeni Gelir Ekle'}</h2>
                <form onSubmit={gelirEkle} className="space-y-4">
                  <input type="text" placeholder="Gelir Kaynağı" value={gelirForm.kaynak} onChange={(e) => setGelirForm({ ...gelirForm, kaynak: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required />
                  <input type="number" placeholder="Tutar (TL)" value={gelirForm.tutar} onChange={(e) => setGelirForm({ ...gelirForm, tutar: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required />
                  <input type="text" placeholder="Açıklama" value={gelirForm.aciklama} onChange={(e) => setGelirForm({ ...gelirForm, aciklama: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} />
                  <button type="submit" className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-lg hover:bg-emerald-700 text-sm">Kaydet</button>
                </form>
              </div>

              {/* YENİ GİDER EKLE */}
              <div className={`${cardBg} p-6 rounded-xl shadow-sm border`}>
                <h2 className="text-lg font-semibold mb-4">{duzenlenenGiderId ? 'Gideri Düzenle' : 'Yeni Gider Ekle'}</h2>
                <form onSubmit={giderEkle} className="space-y-4">
                  <div>
                    <input type="file" accept="image/*" capture="environment" onChange={fisOkut} className="hidden" id="kamera-gider" />
                    <label htmlFor="kamera-gider" className="w-full bg-slate-800 text-white font-medium py-2.5 rounded-lg hover:bg-slate-700 transition text-sm text-center cursor-pointer flex items-center justify-center gap-2 mb-2">
                      📸 Kamerayla Fiş Okut
                    </label>
                  </div>
                  <input type="text" placeholder="Firma / Kime Ödendi" value={giderForm.kimeOdenecek} onChange={(e) => setGiderForm({ ...giderForm, kimeOdenecek: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required />
                  
                  <select value={giderForm.kategori} onChange={(e) => setGiderForm({ ...giderForm, kategori: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required>
                    {kategoriler.map((kat, idx) => <option key={idx} value={kat} className={darkMode ? 'bg-slate-900 text-white' : ''}>{kat}</option>)}
                  </select>

                  <input type="number" placeholder="Tutar (TL)" value={giderForm.tutar} onChange={(e) => setGiderForm({ ...giderForm, tutar: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required />

                  {/* ESNEK KDV ORANI GİRİŞİ */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">KDV Oranı (%):</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Örn: 20, 16.67, 10, 8" 
                        value={giderForm.kdvOrani} 
                        onChange={(e) => setGiderForm({ ...giderForm, kdvOrani: e.target.value })} 
                        className={`w-full border ${inputBg} rounded-lg p-2 text-sm`} 
                      />
                      <div className="bg-blue-500/10 text-blue-400 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap">
                        KDV: {anlikKdvHesapla(giderForm.tutar, giderForm.kdvOrani)}
                      </div>
                    </div>
                  </div>

                  <input type="text" placeholder="Açıklama" value={giderForm.aciklama} onChange={(e) => setGiderForm({ ...giderForm, aciklama: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} />
                  <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 text-sm">Kaydet</button>
                </form>
              </div>
            </div>

            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4`}>
              <div className="flex justify-between items-center">
                <h2 className="text-md font-semibold">Bugünün İşlemleri</h2>
                <input type="text" placeholder="Ara..." value={islemArama} onChange={(e) => setIslemArama(e.target.value)} className={`border ${inputBg} rounded-lg p-2 text-sm w-64`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${tableHeader} text-sm`}>
                      <th className="pb-3">Tarih</th>
                      <th className="pb-3">Tür</th>
                      <th className="pb-3">Kaynak/Firma</th>
                      <th className="pb-3">Kategori</th>
                      <th className="pb-3">Tutar</th>
                      <th className="pb-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                    {siralanmisKasaListesi.length === 0 ? (
                      <tr><td colSpan="6" className="py-4 text-center text-slate-500">Bugün kayıt yok.</td></tr>
                    ) : (
                      siralanmisKasaListesi.map((item) => (
                        <tr key={item.id} className={tableRowHover}>
                          <td className="py-3">{new Date(item.tarih).toLocaleDateString()}</td>
                          <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs ${item.tip === 'gelir' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{item.tip}</span></td>
                          <td className="py-3 font-medium">{item.isimVeyaKaynak}</td>
                          <td className="py-3">{item.kategori}</td>
                          <td className={`py-3 font-semibold ${item.tip === 'gelir' ? 'text-emerald-500' : 'text-red-500'}`}>{item.tutar} TL</td>
                          <td className="py-3 text-right space-x-2">
                            <button onClick={() => item.tip === 'gelir' ? gelirDuzenleBaslat(item.orijinalVeri) : giderDuzenleBaslat(item.orijinalVeri)} className="text-amber-500 text-xs">Düzenle</button>
                            <button onClick={() => item.tip === 'gelir' ? gelirSil(item.gercekId) : giderSil(item.gercekId)} className="text-red-500 text-xs">Sil</button>
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
              <div className={`${cardBg} p-6 rounded-xl shadow-sm border max-w-xl mx-auto`}>
                <h2 className="text-lg font-semibold mb-4">Yeni Talep Oluştur & Fiş Okut</h2>
                <form onSubmit={talepEkle} className="space-y-4">
                  <div>
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => fisOkutGenel(e, talepForm, setTalepForm)} className="hidden" id="kamera-talep" />
                    <label htmlFor="kamera-talep" className="w-full bg-slate-800 text-white font-medium py-2.5 rounded-lg hover:bg-slate-700 text-sm cursor-pointer flex items-center justify-center gap-2 mb-2">
                      📸 Kamerayla Fiş Okut
                    </label>
                  </div>
                  <input type="text" placeholder="Firma / Kime Ödenecek" value={talepForm.kimeOdenecek} onChange={(e) => setTalepForm({ ...talepForm, kimeOdenecek: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required />
                  
                  <select value={talepForm.kategori} onChange={(e) => setTalepForm({ ...talepForm, kategori: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required>
                    {kategoriler.map((kat, idx) => <option key={idx} value={kat} className={darkMode ? 'bg-slate-900 text-white' : ''}>{kat}</option>)}
                  </select>

                  <input type="number" placeholder="Tutar (TL)" value={talepForm.tutar} onChange={(e) => setTalepForm({ ...talepForm, tutar: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} required />

                  {/* KDV ORANI */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">KDV Oranı (%):</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Örn: 20, 16.67, 10, 8" 
                        value={talepForm.kdvOrani} 
                        onChange={(e) => setTalepForm({ ...talepForm, kdvOrani: e.target.value })} 
                        className={`w-full border ${inputBg} rounded-lg p-2 text-sm`} 
                      />
                      <div className="bg-blue-500/10 text-blue-400 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap">
                        KDV: {anlikKdvHesapla(talepForm.tutar, talepForm.kdvOrani)}
                      </div>
                    </div>
                  </div>

                  <input type="text" placeholder="Açıklama" value={talepForm.aciklama} onChange={(e) => setTalepForm({ ...talepForm, aciklama: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2.5 text-sm`} />
                  <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 text-sm">Talep Gönder</button>
                </form>
              </div>
            )}

            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4`}>
              <h2 className="text-lg font-semibold">{girisYapanKullanici.rol === 'Personel' ? 'Taleplerim' : 'Onay Bekleyen Talepler'}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${tableHeader} text-sm`}>
                      <th className="pb-3">Tarih</th>
                      <th className="pb-3">Firma</th>
                      <th className="pb-3">Kategori</th>
                      <th className="pb-3">Tutar</th>
                      <th className="pb-3">Durum</th>
                      {(girisYapanKullanici.rol === 'Yonetici' || girisYapanKullanici.rol === 'Muhasebe') && <th className="pb-3 text-right">İşlemler</th>}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${tableDivider} text-sm`}>
                    {giderTalepleri.length === 0 ? (
                      <tr><td colSpan="6" className="py-4 text-center text-slate-500">Talep yok.</td></tr>
                    ) : (
                      giderTalepleri.map((talep) => (
                        <tr key={talep.id} className={tableRowHover}>
                          <td className="py-3">{new Date(talep.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium">{talep.kimeOdenecek}</td>
                          <td className="py-3">{talep.kategori}</td>
                          <td className="py-3 font-semibold">{talep.tutar} TL</td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              talep.durum === 'Onaylandı' ? 'bg-emerald-500/10 text-emerald-500' : 
                              talep.durum === 'Reddedildi' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {talep.durum || 'Bekliyor'}
                            </span>
                          </td>
                          {(girisYapanKullanici.rol === 'Yonetici' || girisYapanKullanici.rol === 'Muhasebe') && talep.durum !== 'Onaylandı' && talep.durum !== 'Reddedildi' && (
                            <td className="py-3 text-right space-x-2">
                              <button onClick={() => talepOnayla(talep.id)} className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded text-xs font-medium hover:bg-emerald-500/20">Onayla</button>
                              <button onClick={() => talepReddet(talep.id)} className="bg-red-500/10 text-red-500 px-3 py-1 rounded text-xs font-medium hover:bg-red-500/20">Reddet</button>
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
          <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4`}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Raporlar</h2>
              <div className="flex gap-2">
                <button onClick={raporlariArsivle} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Arşivle</button>
                <button onClick={excelIndir} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm">Excel</button>
                <button onClick={pdfIndir} className="bg-rose-600 text-white px-3 py-1.5 rounded text-sm">PDF</button>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(aylikRapor).map(([ay, veri]) => (
                <div key={ay} className={`border ${darkMode ? 'border-slate-800' : 'border-slate-200'} p-4 rounded-xl flex justify-between items-center text-sm`}>
                  <span className="font-bold">{ay}</span>
                  <div className="space-x-4">
                    <span className="text-emerald-500">Gelir: +{veri.gelir} TL</span>
                    <span className="text-red-500">Gider: -{veri.gider} TL</span>
                    <span className="font-bold">Net: {veri.gelir - veri.gider} TL</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GEÇMİŞ SEKMESİ */}
        {aktifSekme === 'gecmis' && girisYapanKullanici.rol !== 'Personel' && (
          <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-4`}>
            <h2 className="text-lg font-semibold">İşlem Geçmişi</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className={`border-b ${tableHeader}`}>
                  <th className="pb-3">Tarih</th>
                  <th className="pb-3">Tür</th>
                  <th className="pb-3">Detay</th>
                  <th className="pb-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${tableDivider}`}>
                {tumIslemGecmisi.map(item => (
                  <tr key={item.id} className={tableRowHover}>
                    <td className="py-3 text-xs text-slate-400">{new Date(item.tarih).toLocaleString()}</td>
                    <td className="py-3 font-medium">{item.tur}</td>
                    <td className="py-3">{item.aciklama}</td>
                    <td className="py-3 text-right font-semibold">{item.tutar} TL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* YÖNETİM SEKMESİ */}
        {aktifSekme === 'kullanicilar' && girisYapanKullanici.rol === 'Yonetici' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`${cardBg} p-6 rounded-xl shadow-sm border space-y-6`}>
              <form onSubmit={kullaniciKaydetVeyaGuncelle} className="space-y-4">
                <h2 className="text-lg font-semibold">Kullanıcı Ekle/Düzenle</h2>
                <input type="text" placeholder="Ad Soyad" value={yeniKullaniciForm.adSoyad} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, adSoyad: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2 text-sm`} required />
                <input type="text" placeholder="Kullanıcı Adı" value={yeniKullaniciForm.kullaniciAdi} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, kullaniciAdi: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2 text-sm`} required />
                <input type="password" placeholder="Şifre" value={yeniKullaniciForm.sifre} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, sifre: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2 text-sm`} />
                <select value={yeniKullaniciForm.rol} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, rol: e.target.value })} className={`w-full border ${inputBg} rounded-lg p-2 text-sm`}>
                  <option value="Personel" className={darkMode ? 'bg-slate-900 text-white' : ''}>Personel</option>
                  <option value="Muhasebe" className={darkMode ? 'bg-slate-900 text-white' : ''}>Muhasebe</option>
                  <option value="Yonetici" className={darkMode ? 'bg-slate-900 text-white' : ''}>Yönetici / Sistem Yöneticisi</option>
                </select>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded text-sm">Kaydet</button>
              </form>

              <hr className={darkMode ? 'border-slate-800' : 'border-slate-100'} />

              <form onSubmit={yeniKategoriEkle} className="space-y-4">
                <h2 className="text-lg font-semibold">Kategori Ekle</h2>
                <input type="text" placeholder="Kategori Adı" value={yeniKategoriAdi} onChange={(e) => setYeniKategoriAdi(e.target.value)} className={`w-full border ${inputBg} rounded-lg p-2 text-sm`} required />
                <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded text-sm">Ekle</button>
              </form>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {kategoriler.map((kat, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-1 bg-slate-500/10 rounded">
                    <span><span>{kat}</span></span>
                    <button onClick={() => kategoriSil(kat)} className="text-red-500">Sil</button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${cardBg} md:col-span-2 p-6 rounded-xl shadow-sm border`}>
              <h2 className="text-lg font-semibold mb-4">Sistem Kullanıcıları</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className={`border-b ${tableHeader}`}>
                    <th className="pb-3">Ad Soyad</th>
                    <th className="pb-3">Kullanıcı Adı</th>
                    <th className="pb-3">Rol</th>
                    <th className="pb-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tableDivider}`}>
                  {kullanicilar.map(kul => (
                    <tr key={kul.id} className={tableRowHover}>
                      <td className="py-3 font-medium">{kul.adSoyad}</td>
                      <td className="py-3">{kul.kullaniciAdi}</td>
                      <td className="py-3">{kul.rol}</td>
                      <td className="py-3 text-right space-x-2">
                        <button onClick={() => kullaniciDuzenleBaslat(kul)} className="text-amber-500 text-xs">Düzenle</button>
                        <button onClick={() => kullaniciSil(kul.id)} className="text-red-500 text-xs">Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export data App -> export default App