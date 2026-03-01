# Falken's Maze

Blog y herramientas de Física Médica & Medicina Nuclear.

## 🚀 Tecnologías

- **React 18** - UI library
- **Vite 6** - Build tool
- **React Router** - Navegación
- **Firebase** - Backend (Firestore + Auth)
- **Chart.js** - Gráficos
- **dicom-parser** - Procesamiento DICOM
- **marked** - Renderizado Markdown

## 📦 Instalación

```bash
npm install
```

## 🛠️ Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

## 🏗️ Build

```bash
npm run build
```

Los archivos compilados estarán en `dist/`

## 📝 Estructura

```
src/
├── components/       # Componentes reutilizables
│   ├── Layout.jsx
│   ├── Sidebar.jsx
│   └── Topbar.jsx
├── pages/           # Páginas principales
│   ├── Blog.jsx
│   ├── Admin.jsx
│   ├── ConvertUnits.jsx
│   ├── DecayCalculator.jsx
│   ├── RestricionesLu177.jsx
│   └── UniformidadGamma.jsx
├── utils/           # Utilidades
│   ├── dicomParser.js
│   ├── nemaAlgorithms.js
│   └── canvasRenderer.js
├── styles/          # Estilos
│   ├── styles.css
│   └── admin.css
├── firebase.js      # Configuración Firebase
├── App.jsx          # Router principal
└── main.jsx         # Entry point
```

## 🔧 Herramientas

### Conversor Ci–Bq
Conversión entre unidades de actividad radiactiva (Curie ↔ Becquerel)

### Decay Calculator
Cálculo de actividad residual usando la fórmula: A(t) = A₀ · e^(-λt)

### Restricciones Lu-177
Cálculo de restricciones dosimétricas para tratamientos con Lu-177 (DOTA-TATE / PSMA-617)

### Uniformidad NEMA
Análisis de uniformidad intrínseca de gammacámara según NEMA NU 1-2012

## 🔐 Admin

Accede a `/admin` para crear posts. Requiere autenticación con Google.

**Configuración:**
1. Activa Google Auth en Firebase Console
2. Inicia sesión y copia tu UID
3. Añade tu UID a las reglas de Firestore

## 📄 Licencia

Proyecto personal de Física Médica
