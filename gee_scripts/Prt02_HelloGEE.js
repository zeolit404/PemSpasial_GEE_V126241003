// ============================================================
// SCRIPT 2.1 & 2.2 — Mengenal & Operasi ee.Geometry
// Disesuaikan khusus untuk AOI Sanggala Utara
// ============================================================

// 1. Panggil AOI Sanggala Utara dari Assets
var aoiSanggala = ee.FeatureCollection("projects/ma-project-of-indonesian/assets/Sanggala_Utara");

// 2. Ambil "bentuk" Geometry-nya saja
var aoi = aoiSanggala.geometry();

// 3. Operasi Geometry: Cari Pusat dan Kotak Pembungkus
var pusatAOI = aoi.centroid(1);  // Mencari titik tepat di tengah Sanggala Utara
var kotakAOI = aoi.bounds();     // Membuat kotak terkecil yang membungkus Sanggala Utara

// 4. Operasi Geometry: Buffer (Perluasan & Penyempitan)
// Kita buat buffer 2km (2000 meter) ke luar, dan 1km (-1000 meter) ke dalam
var aoiPlus2km = aoi.buffer(2000);
var aoiMinus1km = aoi.buffer(-1000);

// 5. Hitung Luas Wilayah Sanggala Utara
var luasM2 = aoi.area(1);
var luasKm2 = luasM2.divide(1e6); // Konversi dari meter persegi ke kilometer persegi

// ============================================================
// TAMPILKAN HASIL DI CONSOLE & PETA
// ============================================================

print("=== STATISTIK SANGGALA UTARA ===");
print("Luas Area (km²):", luasKm2);
print("Koordinat Pusat:", pusatAOI.coordinates());
print("Tipe Geometry  :", aoi.type());

// Zoom peta otomatis ke Sanggala Utara (Level 13)
Map.centerObject(aoi, 13);

// Tampilkan semua lapisan dari yang paling besar ke paling kecil
Map.addLayer(kotakAOI, { color: "FFFF00", opacity: 0.3 }, "1. Kotak Pembungkus (Bounds)");
Map.addLayer(aoiPlus2km, { color: "0000FF", opacity: 0.2 }, "2. Buffer Luar (+2km)");
Map.addLayer(aoi, { color: "FF0000", opacity: 0.5 }, "3. Sanggala Utara (Asli)");
Map.addLayer(aoiMinus1km, { color: "FF6600", opacity: 0.3 }, "4. Buffer Dalam (-1km)");
Map.addLayer(pusatAOI, { color: "00FF00" }, "5. Titik Pusat (Centroid)");

// ============================================================
// SCRIPT 3.1 & 3.2 — Eksplorasi Citra & Indeks Spektral
// Disesuaikan khusus untuk AOI Sanggala Utara
// ============================================================

// 1. Panggil batas wilayah Sanggala Utara
var aoiSanggala = ee.FeatureCollection("projects/ma-project-of-indonesian/assets/Sanggala_Utara");
var aoi = aoiSanggala.geometry();

// 2. Cari 1 citra Landsat 9 terbaik (paling bersih awan) di tahun 2024
var citra = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    .filterDate("2024-01-01", "2024-12-31")
    .filterBounds(aoi)
    .sort("CLOUD_COVER")  // Urutkan dari yang paling sedikit awannya
    .first();             // Ambil urutan pertama

// 3. Tampilkan informasi citra tersebut di Console
var tglAkuisisi = citra.date().format('YYYY-MM-dd');
var cloudPct = citra.get('CLOUD_COVER');

print('=== INFO CITRA TERBAIK SANGGALA UTARA ===');
print('Tanggal akuisisi :', tglAkuisisi);
print('Cloud cover (%)  :', cloudPct);

// ============================================================
// KALKULASI INDEKS SPEKTRAL (Bagian 3.2)
// ============================================================

// 4. Hitung NDVI (Vegetasi), NDWI (Air), dan NDBI (Bangunan)
var ndvi = citra.normalizedDifference(['SR_B5', 'SR_B4']); // (NIR-Merah)/(NIR+Merah)
var ndwi = citra.normalizedDifference(['SR_B3', 'SR_B5']); // (Hijau-NIR)/(Hijau+NIR)
var ndbi = citra.normalizedDifference(['SR_B6', 'SR_B5']); // (SWIR-NIR)/(SWIR+NIR)

// 5. Hitung rata-rata nilai NDVI khusus di dalam area Sanggala Utara
var statsNDVI = ndvi.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 30, // Resolusi 30 meter untuk Landsat
    maxPixels: 1e10
});
print('Rata-rata NDVI Sanggala Utara:', statsNDVI);

// ============================================================
// VISUALISASI PETA
// ============================================================

Map.centerObject(aoi, 13);

// Tampilan Foto Asli & False Color (Hanya sebatas potongan Sanggala Utara)
var citraClip = citra.clip(aoi);
Map.addLayer(citraClip, { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 7000, max: 13000, gamma: 1.4 }, '1. True Color');
Map.addLayer(citraClip, { bands: ['SR_B5', 'SR_B4', 'SR_B3'], min: 7000, max: 20000 }, '2. False Color (Vegetasi Merah)', false);

// Tampilan Indeks Spektral
Map.addLayer(ndvi.clip(aoi), { min: -0.2, max: 0.8, palette: ['red', 'yellow', 'lightgreen', 'green', 'darkgreen'] }, '3. NDVI (Vegetasi)');
Map.addLayer(ndwi.clip(aoi), { min: -0.5, max: 0.5, palette: ['saddlebrown', 'white', 'deepskyblue', 'navy'] }, '4. NDWI (Air)', false);
Map.addLayer(ndbi.clip(aoi), { min: -0.3, max: 0.3, palette: ['white', 'orange', 'red'] }, '5. NDBI (Bangunan)', false);

// Garis batas wilayah
Map.addLayer(aoiSanggala.style({ color: 'red', fillColor: '00000000', width: 2 }), {}, "Batas Sanggala Utara");

// ============================================================
// SCRIPT 4.1 & 4.2 — Eksplorasi Data & Pembuatan Composite T1/T2
// Disesuaikan khusus untuk AOI Sanggala Utara
// ============================================================

// 1. Panggil batas wilayah Sanggala Utara
var aoiSanggala = ee.FeatureCollection("projects/ma-project-of-indonesian/assets/Sanggala_Utara");
var aoi = aoiSanggala.geometry();

// ============================================================
// BAGIAN 4.1: Eksplorasi Ketersediaan Data
// ============================================================
// Cek ketersediaan foto Landsat 9 di Sanggala Utara (2023-2024) dengan awan < 20%
var koleksiCek = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    .filterDate("2023-01-01", "2024-12-31")
    .filterBounds(aoi)
    .filterMetadata("CLOUD_COVER", "less_than", 20);

print('=== KETERSEDIAAN DATA ===');
print('Jumlah citra cek (Cloud < 20%):', koleksiCek.size(), 'scene');

// ============================================================
// BAGIAN 4.2: Membuat Composite T1 (Masa Lalu) & T2 (Masa Kini)
// ============================================================

// 2. Fungsi untuk membersihkan awan (Cloud Masking) secara otomatis
function maskL8sr(image) {
    var qa = image.select('QA_PIXEL');
    var cloudShadow = qa.bitwiseAnd(1 << 3).neq(0);
    var cloud = qa.bitwiseAnd(1 << 4).neq(0);
    var mask = cloudShadow.or(cloud).not();
    return image.updateMask(mask).copyProperties(image, image.propertyNames());
}

// 3. T1: PERIODE AWAL (Kondisi Sebelum) -> Landsat 8 (2015-2016)
var koleksiT1 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterDate("2015-01-01", "2016-12-31")
    .filterBounds(aoi)
    .filterMetadata("CLOUD_COVER", "less_than", 30) // Agak dilonggarkan karena ini data lama
    .map(maskL8sr);
print('Jumlah citra T1 (2015-2016):', koleksiT1.size());

// 4. T2: PERIODE AKHIR (Kondisi Sekarang) -> Landsat 9 (2023-2024)
var koleksiT2 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    .filterDate("2023-01-01", "2024-12-31")
    .filterBounds(aoi)
    .filterMetadata("CLOUD_COVER", "less_than", 20)
    .map(maskL8sr);
print('Jumlah citra T2 (2023-2024):', koleksiT2.size());

// 5. Gabungkan (Median) lalu potong (Clip) sesuai batas Sanggala Utara
var compositeT1 = koleksiT1.median().clip(aoi);
var compositeT2 = koleksiT2.median().clip(aoi);

// ============================================================
// TAMPILKAN DI PETA DAN EKSPOR KE DRIVE
// ============================================================
Map.centerObject(aoi, 13);
var vis = { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 7000, max: 13000, gamma: 1.4 };

// Menampilkan peta
Map.addLayer(compositeT1, vis, '1. Composite T1 (2015-2016)');
Map.addLayer(compositeT2, vis, '2. Composite T2 (2023-2024)', false);
Map.addLayer(aoiSanggala.style({ color: 'red', fillColor: '00000000' }), {}, "Batas Sanggala Utara");

// Minta GEE mengirim foto T2 ini ke Google Drive-mu
Export.image.toDrive({
    image: compositeT2,
    description: 'Composite_T2_Sanggala_Utara',
    folder: 'ProyekGEE_PemSpasial',
    region: aoi,
    scale: 30,
    crs: 'EPSG:4326'
});