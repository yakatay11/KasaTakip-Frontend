import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const API_URL = "https://kasa-takip-byfabric.onrender.com/api"; 

function App() {
  const [girisYapanKullanici, setGirisYapanKullanici] = useState(null);
  const [loginForm, setLoginForm] = useState({ kullaniciAdi: '', sifre: '' });
  const [yukleniyor, setYukleniyor] = useState(false);

  const [giderler, setGiderler] = useState([]);
  const [gelirler, setGelirler] = useState([]);
  const [arşivRaporlar, setArşivRaporlar] = useState([]);
  const [giderTalepleri, setGiderTalepleri] = useState([]);
  const [kullanicilar, setKullanicilar] = useState([]);

  // --- DÜZENLEME STATE'LERİ ---
  const [duzenlenenGelirId, setDuzenlenenGelirId] = useState(null);
  const [duzenlenenGiderId, setDuzenlenenGiderId] = useState(null);

  // --- FİLTRELEME STATE'LERİ ---
  const [aramaMetni, setAramaMetni] = useState('');
  const [baslangicTarihi, setBaslangicTarihi] = useState('');
  const [bitisTarihi, setBitisTarihi] = useState('');

  // --- RAPOR AKORDİYON STATE'İ ---
  const [secilenAy, setSecilenAy] = useState(null);

  // --- FORM STATE'LERİ & TASLAK ID'LERİ ---
  const [giderForm, setGiderForm] = useState(() => {
    const saved = localStorage.getItem('kasa_giderForm');
    return saved ? JSON.parse(saved) : { kimeOdenecek: '', kategori: '', tutar: '', aciklama: '' };
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
    return saved ? JSON.parse(saved) : { kimeOdenecek: '', kategori: '', tutar: '', aciklama: '' };
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
              kategori: giderForm.kategori || '-',
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
                kategori: giderForm.kategori || '-',
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
              kategori: talepForm.kategori || '-',
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
                kategori: talepForm.kategori || '-',
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
        setGirisYapanKullanici({ id: data.id, adSoyad: data.adSoyad, rol: data.rol });
        if (data.rol === 'Personel') setAktifSekme('talepler');
        else setAktifSekme('islemler');
      } else { 
        alert(data.message || "Giriş başarısız!"); 
      }
    } catch (error) { 
      console.error("Giriş hatası:", error); 
      alert("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  const cikisYap = () => {
    setGirisYapanKullanici(null);
    setLoginForm({ kullaniciAdi: '', sifre: '' });
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
            kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori,
            tutar: parseFloat(giderForm.tutar), aciklama: giderForm.aciklama,
            tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
          })
        });
        setDuzenlenenGiderId(null);
        alert("Gider başarıyla güncellendi.");
      } else {
        if (giderTaslakId) {
          await fetch(`${API_URL}/Gider/${giderTaslakId}?rol=${userRol}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori,
              tutar: parseFloat(giderForm.tutar), aciklama: giderForm.aciklama,
              tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
            })
          });
        } else {
          await fetch(`${API_URL}/Gider`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kimeOdendi: giderForm.kimeOdenecek, kategori: giderForm.kategori,
              tutar: parseFloat(giderForm.tutar), aciklama: giderForm.aciklama,
              tarih: new Date().toISOString(), islemiYapanAdminId: girisYapanKullanici.id
            })
          });
        }
      }

      setGiderForm({ kimeOdenecek: '', kategori: '', tutar: '', aciklama: '' });
      setGiderTaslakId(null);
      localStorage.removeItem('kasa_giderForm');
      localStorage.removeItem('kasa_giderTaslakId');
      verileriGetir();
    } catch (error) { console.error("Gider ekleme hatası:", error); }
  };

  const giderDuzenleBaslat = (item) => {
    setDuzenlenenGiderId(item.id);
    setGiderForm({ kimeOdenecek: item.kimeOdendi, kategori: item.kategori, tutar: item.tutar, aciklama: item.aciklama || '' });
  };

  const giderSil = async (id) => {
    if (!window.confirm("Bu gideri silmek istediğinize emin misiniz?")) return;
    try {
      const userRol = girisYapanKullanici ? girisYapanKullanici.rol : '';
      const response = await fetch(`${API_URL}/Gider/${id}?rol=${userRol}`, { method: 'DELETE' });
      if (response.ok) {
        if (id === giderTaslakId) {
           setGiderTaslakId(null);
           setGiderForm({ kimeOdenecek: '', kategori: '', tutar: '', aciklama: '' });
           localStorage.removeItem('kasa_giderForm');
           localStorage.removeItem('kasa_giderTaslakId');
        }
        verileriGetir();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.message || "Bu işlem için yetkiniz yok.");
      }
    } catch (error) { console.error("Silme hatası:", error); }
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
        alert("Gelir başarıyla güncellendi.");
      } else {
        if (gelirTaslakId) {
          await fetch(`${API_URL}/Gelir/${gelirTaslakId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kaynak: gelirForm.kaynak, tutar: parseFloat(gelirForm.tutar),
              aciklama: gelirForm.aciklama, tarih: new Date().toISOString()
            })
          });
        } else {
          await fetch(`${API_URL}/Gelir`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kaynak: gelirForm.kaynak, tutar: parseFloat(gelirForm.tutar),
              aciklama: gelirForm.aciklama, tarih: new Date().toISOString()
            })
          });
        }
      }

      setGelirForm({ kaynak: '', tutar: '', aciklama: '' });
      setGelirTaslakId(null);
      localStorage.removeItem('kasa_gelirForm');
      localStorage.removeItem('kasa_gelirTaslakId');
      verileriGetir();
    } catch (error) { console.error("Gelir ekleme hatası:", error); }
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
      } else {
        alert("Gelir silinemedi.");
      }
    } catch (error) { console.error("Gelir silme hatası:", error); }
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
            kimeOdenecek: talepForm.kimeOdenecek, kategori: talepForm.kategori,
            tutar: parseFloat(talepForm.tutar), aciklama: talepForm.aciklama,
            tarih: new Date().toISOString()
          })
        });
      } else {
        await fetch(`${API_URL}/GiderTalebi`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            talepEdenPersonelId: girisYapanKullanici.id,
            kimeOdenecek: talepForm.kimeOdenecek, kategori: talepForm.kategori,
            tutar: parseFloat(talepForm.tutar), aciklama: talepForm.aciklama,
            tarih: new Date().toISOString()
          })
        });
      }

      setTalepForm({ kimeOdenecek: '', kategori: '', tutar: '', aciklama: '' });
      setTalepTaslakId(null);
      localStorage.removeItem('kasa_talepForm');
      localStorage.removeItem('kasa_talepTaslakId');
      verileriGetir();
      alert("Gelir/Gider talebi başarıyla oluşturuldu.");
    } catch (error) { console.error("Talep oluşturma hatası:", error); }
  };

  const talepOnayla = async (id) => {
    try {
      const response = await fetch(`${API_URL}/GiderTalebi/${id}/onayla`, { method: 'PUT' });
      if (response.ok) {
        verileriGetir();
        alert("Talep onaylandı ve kasaya işlendi.");
      }
    } catch (error) { console.error("Talep onaylama hatası:", error); }
  };

  const yeniKullaniciEkle = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/Kullanici`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(yeniKullaniciForm)
      });
      if (response.ok) {
        setYeniKullaniciForm({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'Personel' });
        verileriGetir();
        alert("Kullanıcı başarıyla eklendi.");
      }
    } catch (error) { console.error("Kullanıcı ekleme hatası:", error); }
  };

  // --- Raporlama & Hesaplamalar ---
  const toplamGelir = gelirler.reduce((toplam, item) => toplam + item.tutar, 0);
  const toplamGider = giderler.reduce((toplam, item) => toplam + item.tutar, 0);
  const netBakiye = toplamGelir - toplamGider;

  const aylikRapor = {};
  [...gelirler.map(i => ({ ...i, tip: 'gelir' })), ...giderler.map(i => ({ ...i, tip: 'gider' }))].forEach(item => {
    const tarihObj = new Date(item.tarih);
    const ayYil = tarihObj.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    if (!aylikRapor[ayYil]) aylikRapor[ayYil] = { gelir: 0, gider: 0, detaylar: [] };
    if (item.tip === 'gelir') aylikRapor[ayYil].gelir += item.tutar;
    else aylikRapor[ayYil].gider += item.tutar;
    aylikRapor[ayYil].detaylar.push(item);
  });

  const raporlariArsivle = async () => {
    try {
      for (const [ay, veri] of Object.entries(aylikRapor)) {
        await fetch(`${API_URL}/AylikRapor/olustur`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ayYil: ay, toplamGelir: veri.gelir, toplamGider: veri.gider, netBakiye: veri.gelir - veri.gider })
        });
      }
      verileriGetir();
      alert("Aylık raporlar başarıyla arşivlendi!");
    } catch (error) { console.error("Arşivleme hatası:", error); }
  };

  const excelIndir = () => {
    const veriDizisi = Object.entries(aylikRapor).map(([ay, veri]) => ({
      "Ay / Yıl": ay, "Toplam Gelir (TL)": veri.gelir, "Toplam Gider (TL)": veri.gider, "Net Durum (TL)": veri.gelir - veri.gider
    }));
    const worksheet = XLSX.utils.json_to_sheet(veriDizisi);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AylikRapor");
    XLSX.writeFile(workbook, "Aylik_Finansal_Rapor.xlsx");
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
  };

  // --- TARİH VE METİN FİLTRELEME FONKSİYONLARI ---
  const tarihFiltresiUygula = (itemTarih) => {
    if (!baslangicTarihi && !bitisTarihi) return true;
    const itemDate = new Date(itemTarih).toISOString().split('T')[0];
    if (baslangicTarihi && itemDate < baslangicTarihi) return false;
    if (bitisTarihi && itemDate > bitisTarihi) return false;
    return true;
  };

  const filtrelenmisGelirler = gelirler.filter(item => {
    const metinUyumu = (item.kaynak || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
                       (item.aciklama || '').toLowerCase().includes(aramaMetni.toLowerCase());
    return metinUyumu && tarihFiltresiUygula(item.tarih);
  });

  const filtrelenmisGiderler = giderler.filter(item => {
    const metinUyumu = (item.kimeOdendi || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
                       (item.kategori || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
                       (item.aciklama || '').toLowerCase().includes(aramaMetni.toLowerCase());
    return metinUyumu && tarihFiltresiUygula(item.tarih);
  });

  if (!girisYapanKullanici) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">Kasa Takip Sistemi</h1>
            <p className="text-sm text-slate-500">Lütfen kullanıcı bilgileriyle giriş yapın</p>
          </div>
          <form onSubmit={girisYap} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kullanıcı Adı</label>
              <input
                type="text" value={loginForm.kullaniciAdi}
                onChange={(e) => setLoginForm({ ...loginForm, kullaniciAdi: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Kullanıcı adınızı girin" required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Şifre</label>
              <input
                type="password" value={loginForm.sifre}
                onChange={(e) => setLoginForm({ ...loginForm, sifre: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••" required
              />
            </div>
            <button 
              type="submit" 
              disabled={yukleniyor}
              className={`w-full text-white font-medium py-3 rounded-lg transition text-sm shadow-sm ${yukleniyor ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {yukleniyor ? 'Giriş Yapılıyor (Sunucu uyanıyor olabilir)...' : 'Sisteme Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Kasa Takip Sistemi</h1>
            <p className="text-xs text-slate-500">Hoş geldiniz, <span className="font-semibold text-slate-700">{girisYapanKullanici.adSoyad}</span> ({girisYapanKullanici.rol})</p>
          </div>
          <button onClick={cikisYap} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-200 transition">
            Çıkış Yap
          </button>
        </div>

        <div className="flex justify-start items-center flex-wrap gap-2 border-b border-slate-200 pb-3 w-full">
          {girisYapanKullanici.rol !== 'Personel' && (
            <button
              onClick={() => setAktifSekme('islemler')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'islemler' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              Kasa & İşlem Yönetimi
            </button>
          )}

          <button
            onClick={() => setAktifSekme('talepler')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'talepler' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            {girisYapanKullanici.rol === 'Personel' ? 'Gelir/Gider Taleplerim' : 'Gelir/Gider Talepleri Onay'}
          </button>

          {girisYapanKullanici.rol !== 'Personel' && (
            <button
              onClick={() => setAktifSekme('raporlar')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'raporlar' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              Günlük & Aylık Raporlar
            </button>
          )}

          {girisYapanKullanici.rol === 'Yonetici' && (
            <button
              onClick={() => setAktifSekme('kullanicilar')}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition ${aktifSekme === 'kullanicilar' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              Kullanıcı Yönetimi
            </button>
          )}
        </div>

        {girisYapanKullanici.rol !== 'Personel' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-400">Toplam Gelir</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{toplamGelir.toLocaleString('tr-TR')} TL</h3>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-400">Toplam Gider</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{toplamGider.toLocaleString('tr-TR')} TL</h3>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-400">Net Kasa Durumu</p>
              <h3 className={`text-2xl font-bold mt-1 ${netBakiye >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {netBakiye.toLocaleString('tr-TR')} TL
              </h3>
            </div>
          </div>
        )}

        {aktifSekme === 'islemler' && girisYapanKullanici.rol !== 'Personel' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">
                  {duzenlenenGelirId ? 'Geliri Düzenle' : `Yeni Gelir Ekle ${gelirTaslakId ? '(Taslak Oluşturuldu)' : ''}`}
                </h2>
                <form onSubmit={gelirEkle} className="space-y-4">
                  <input
                    type="text" placeholder="Gelir Kaynağı (Örn: Satış)"
                    value={gelirForm.kaynak} onChange={(e) => setGelirForm({ ...gelirForm, kaynak: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                  />
                  <input
                    type="number" placeholder="Tutar (TL)"
                    value={gelirForm.tutar} onChange={(e) => setGelirForm({ ...gelirForm, tutar: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                  />
                  <input
                    type="text" placeholder="Açıklama"
                    value={gelirForm.aciklama} onChange={(e) => setGelirForm({ ...gelirForm, aciklama: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="w-full bg-emerald-600 text-white font-medium py-2.5 rounded-lg hover:bg-emerald-700 transition text-sm">
                      {duzenlenenGelirId ? 'Geliri Güncelle' : 'Geliri Kaydet & Onayla'}
                    </button>
                    {duzenlenenGelirId && (
                      <button type="button" onClick={() => { setDuzenlenenGelirId(null); setGelirForm({kaynak: '', tutar: '', aciklama: ''}); }} className="bg-slate-200 text-slate-700 px-4 rounded-lg text-sm">
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">
                  {duzenlenenGiderId ? 'Gideri Düzenle' : `Yeni Gider Ekle ${giderTaslakId ? '(Taslak Oluşturuldu)' : ''}`}
                </h2>
                <form onSubmit={giderEkle} className="space-y-4">
                  <input
                    type="text" placeholder="Kime Ödendi / Firma"
                    value={giderForm.kimeOdenecek} onChange={(e) => setGiderForm({ ...giderForm, kimeOdenecek: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                  />
                  <input
                    type="text" placeholder="Kategori (Örn: Fatura, Ofis)"
                    value={giderForm.kategori} onChange={(e) => setGiderForm({ ...giderForm, kategori: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  />
                  <input
                    type="number" placeholder="Tutar (TL)"
                    value={giderForm.tutar} onChange={(e) => setGiderForm({ ...giderForm, tutar: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                  />
                  <input
                    type="text" placeholder="Açıklama"
                    value={giderForm.aciklama} onChange={(e) => setGiderForm({ ...giderForm, aciklama: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm">
                      {duzenlenenGiderId ? 'Gideri Güncelle' : 'Gideri Kaydet & Onayla'}
                    </button>
                    {duzenlenenGiderId && (
                      <button type="button" onClick={() => { setDuzenlenenGiderId(null); setGiderForm({kimeOdenecek: '', kategori: '', tutar: '', aciklama: ''}); }} className="bg-slate-200 text-slate-700 px-4 rounded-lg text-sm">
                        İptal
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* GENEL FİLTRELEME ÇUBUĞU */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <input
                type="text" placeholder="Arama yap (Firma, kaynak, kategori, açıklama)..." 
                value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 text-sm w-full md:w-80"
              />
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span>Başlangıç:</span>
                  <input 
                    type="date" value={baslangicTarihi} onChange={(e) => setBaslangicTarihi(e.target.value)}
                    className="border border-slate-200 rounded-lg p-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span>Bitiş:</span>
                  <input 
                    type="date" value={bitisTarihi} onChange={(e) => setBitisTarihi(e.target.value)}
                    className="border border-slate-200 rounded-lg p-1.5 text-sm"
                  />
                </div>
                {(baslangicTarihi || bitisTarihi || aramaMetni) && (
                  <button 
                    onClick={() => { setBaslangicTarihi(''); setBitisTarihi(''); setAramaMetni(''); }}
                    className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-200 transition"
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            </div>

            {/* GELİR LİSTESİ TABLOSU */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="text-lg font-semibold text-slate-700">Kasa Gelir Listesi</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-sm">
                      <th className="pb-3 font-medium">Tarih</th>
                      <th className="pb-3 font-medium">Gelir Kaynağı</th>
                      <th className="pb-3 font-medium">Açıklama</th>
                      <th className="pb-3 font-medium">Tutar</th>
                      <th className="pb-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 text-sm">
                    {filtrelenmisGelirler.length === 0 ? (
                      <tr><td colSpan="5" className="py-4 text-center text-slate-400">Gelir kaydı bulunamadı.</td></tr>
                    ) : (
                      filtrelenmisGelirler.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-3">{new Date(item.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium text-slate-800">{item.kaynak}</td>
                          <td className="py-3">{item.aciklama}</td>
                          <td className="py-3 font-semibold text-emerald-600">+{item.tutar.toLocaleString('tr-TR')} TL</td>
                          <td className="py-3 text-right space-x-2">
                            <button onClick={() => gelirDuzenleBaslat(item)} className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-amber-100 transition">Düzenle</button>
                            <button onClick={() => gelirSil(item.id)} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition">Sil</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GİDER LİSTESİ TABLOSU */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="text-lg font-semibold text-slate-700">Kasa Gider Listesi</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-sm">
                      <th className="pb-3 font-medium">Tarih</th>
                      <th className="pb-3 font-medium">Firma / Ödenen</th>
                      <th className="pb-3 font-medium">Kategori</th>
                      <th className="pb-3 font-medium">Açıklama</th>
                      <th className="pb-3 font-medium">Tutar</th>
                      <th className="pb-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 text-sm">
                    {filtrelenmisGiderler.length === 0 ? (
                      <tr><td colSpan="6" className="py-4 text-center text-slate-400">Kayıt bulunamadı.</td></tr>
                    ) : (
                      filtrelenmisGiderler.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-3">{new Date(item.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium text-slate-800">{item.kimeOdendi}</td>
                          <td className="py-3"><span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs">{item.kategori}</span></td>
                          <td className="py-3">{item.aciklama}</td>
                          <td className="py-3 font-semibold text-red-600">-{item.tutar.toLocaleString('tr-TR')} TL</td>
                          <td className="py-3 text-right space-x-2">
                            <button onClick={() => giderDuzenleBaslat(item)} className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-amber-100 transition">Düzenle</button>
                            <button onClick={() => giderSil(item.id)} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition">Sil</button>
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

        {aktifSekme === 'talepler' && (
          <div className="space-y-6">
            {girisYapanKullanici.rol === 'Personel' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 max-w-xl mx-auto">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Yeni Gelir/Gider Talebi Oluştur {talepTaslakId ? '(Taslak Oluşturuldu)' : ''}</h2>
                <form onSubmit={talepEkle} className="space-y-4">
                  <input
                    type="text" placeholder="Kime Ödenecek / Firma"
                    value={talepForm.kimeOdenecek} onChange={(e) => setTalepForm({ ...talepForm, kimeOdenecek: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                  />
                  <input
                    type="text" placeholder="Kategori"
                    value={talepForm.kategori} onChange={(e) => setTalepForm({ ...talepForm, kategori: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  />
                  <input
                    type="number" placeholder="Tutar (TL)"
                    value={talepForm.tutar} onChange={(e) => setTalepForm({ ...talepForm, tutar: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                  />
                  <input
                    type="text" placeholder="Açıklama"
                    value={talepForm.aciklama} onChange={(e) => setTalepForm({ ...talepForm, aciklama: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm"
                  />
                  <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm">
                    Talep Gönder & Onayla
                  </button>
                </form>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="text-lg font-semibold text-slate-700">
                {girisYapanKullanici.rol === 'Personel' ? 'Gelir/Gider Taleplerimin Durumu' : 'Onay Bekleyen Gelir/Gider Talepleri'}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-sm">
                      <th className="pb-3 font-medium">Tarih</th>
                      <th className="pb-3 font-medium">Firma / Ödenen</th>
                      <th className="pb-3 font-medium">Kategori</th>
                      <th className="pb-3 font-medium">Tutar</th>
                      <th className="pb-3 font-medium">Durum</th>
                      {girisYapanKullanici.rol === 'Yonetici' && <th className="pb-3 font-medium text-right">İşlem</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 text-sm">
                    {giderTalepleri.length === 0 ? (
                      <tr><td colSpan="6" className="py-4 text-center text-slate-400">Talep bulunmuyor.</td></tr>
                    ) : (
                      giderTalepleri.map((talep) => (
                        <tr key={talep.id} className="hover:bg-slate-50/50">
                          <td className="py-3">{new Date(talep.tarih).toLocaleDateString()}</td>
                          <td className="py-3 font-medium text-slate-800">{talep.kimeOdenecek}</td>
                          <td className="py-3">{talep.kategori}</td>
                          <td className="py-3 font-semibold">{talep.tutar.toLocaleString('tr-TR')} TL</td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${talep.durum === 'Onaylandı' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              {talep.durum}
                            </span>
                          </td>
                          {girisYapanKullanici.rol === 'Yonetici' && talep.durum === 'Bekliyor' && (
                            <td className="py-3 text-right">
                              <button onClick={() => talepOnayla(talep.id)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
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

        {aktifSekme === 'raporlar' && girisYapanKullanici.rol !== 'Personel' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-700">Aylık Finansal Rapor & Detaylı Günlük Görünüm</h2>
                <div className="flex gap-2">
                  <button onClick={raporlariArsivle} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Raporları Arşivle</button>
                  <button onClick={excelIndir} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition">Excel İndir</button>
                  <button onClick={pdfIndir} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 transition">PDF İndir</button>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(aylikRapor).filter(([_, veri]) => veri.detaylar.length > 0).length === 0 ? (
                  <p className="text-center text-slate-400 py-4">İşlem kaydı bulunan ay bulunmuyor.</p>
                ) : (
                  Object.entries(aylikRapor)
                    .filter(([_, veri]) => veri.detaylar.length > 0) // Sadece içinde işlem olan ayları göster
                    .map(([ayYil, veri]) => {
                      const netDurum = veri.gelir - veri.gider;
                      const isOpen = secilenAy === ayYil;
                      const siraliDetaylar = [...veri.detaylar].sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

                      return (
                        <div key={ayYil} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm transition">
                          {/* Ay Satırı (Tıklanabilir Başlık) */}
                          <div 
                            onClick={() => setSecilenAy(isOpen ? null : ayYil)}
                            className="bg-slate-50 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 text-base capitalize">{ayYil}</span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                {veri.detaylar.length} İşlem
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <span className="text-emerald-600 font-semibold">Gelir: +{veri.gelir.toLocaleString('tr-TR')} TL</span>
                              <span className="text-red-600 font-semibold">Gider: -{veri.gider.toLocaleString('tr-TR')} TL</span>
                              <span className={`font-bold ${netDurum >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                Net: {netDurum.toLocaleString('tr-TR')} TL
                              </span>
                              <span className="text-slate-400 text-xs font-bold">{isOpen ? '▲ Kapat' : '▼ Detay'}</span>
                            </div>
                          </div>

                          {/* Seçilen Ayın Açılır Detay Paneli */}
                          {isOpen && (
                            <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center text-xs text-slate-600">
                                <span>Rapor Dönemi: <strong className="text-slate-800 uppercase">{ayYil}</strong></span>
                                <span>Toplam İşlem Hacmi: <strong>{veri.detaylar.length} adet</strong></span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 text-slate-400 text-xs">
                                      <th className="pb-2 font-medium">Tarih</th>
                                      <th className="pb-2 font-medium">İşlem Türü</th>
                                      <th className="pb-2 font-medium">Kaynak / Firma</th>
                                      <th className="pb-2 font-medium">Kategori / Açıklama</th>
                                      <th className="pb-2 font-medium text-right">Tutar</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50 text-slate-600 text-sm">
                                    {siraliDetaylar.map((item, index) => (
                                      <tr key={index} className="hover:bg-slate-50/50">
                                        <td className="py-2.5 text-xs text-slate-500">{new Date(item.tarih).toLocaleDateString()}</td>
                                        <td className="py-2.5">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.tip === 'gelir' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                            {item.tip === 'gelir' ? 'Gelir' : 'Gider'}
                                          </span>
                                        </td>
                                        <td className="py-2.5 font-medium text-slate-800">{item.kaynak || item.kimeOdendi}</td>
                                        <td className="py-2.5 text-xs text-slate-500">{item.kategori ? `${item.kategori} - ${item.aciklama}` : item.aciklama}</td>
                                        <td className={`py-2.5 text-right font-semibold ${item.tip === 'gelir' ? 'text-emerald-600' : 'text-red-600'}`}>
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

        {aktifSekme === 'kullanicilar' && girisYapanKullanici.rol === 'Yonetici' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
              <h2 className="text-lg font-semibold text-slate-700 mb-4">Yeni Kullanıcı Ekle</h2>
              <form onSubmit={yeniKullaniciEkle} className="space-y-4">
                <input
                  type="text" placeholder="Ad Soyad"
                  value={yeniKullaniciForm.adSoyad} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, adSoyad: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                />
                <input
                  type="text" placeholder="Kullanıcı Adı"
                  value={yeniKullaniciForm.kullaniciAdi} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, kullaniciAdi: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                />
                <input
                  type="password" placeholder="Şifre"
                  value={yeniKullaniciForm.sifre} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, sifre: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm" required
                />
                <select
                  value={yeniKullaniciForm.rol} onChange={(e) => setYeniKullaniciForm({ ...yeniKullaniciForm, rol: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-white"
                >
                  <option value="Yonetici">Yönetici</option>
                  <option value="Muhasebe">Muhasebe</option>
                  <option value="Personel">Personel</option>
                </select>
                <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition text-sm">
                  Kullanıcıyı Kaydet
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="text-lg font-semibold text-slate-700">Sistem Kullanıcıları</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-sm">
                      <th className="pb-3 font-medium">Ad Soyad</th>
                      <th className="pb-3 font-medium">Kullanıcı Adı</th>
                      <th className="pb-3 font-medium">Rol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600 text-sm">
                    {kullanicilar.map((kul) => (
                      <tr key={kul.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-medium text-slate-800">{kul.adSoyad}</td>
                        <td className="py-3">{kul.kullaniciAdi}</td>
                        <td className="py-3">
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-medium">
                            {kul.rol}
                          </span>
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