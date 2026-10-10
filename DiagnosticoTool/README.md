# DiagnosticoTool — SOS PC QR

Herramienta local de diagnóstico de hardware para Windows 10/11.  
Desarrollada en **C# / .NET 8**. Solo lectura — no modifica el sistema.

---

## ¿Qué hace?

Recopila información real del equipo usando **WMI** y **LibreHardwareMonitorLib** y genera un archivo `diagnostico.json` que luego se importa en la sección "Diagnóstico del Sistema" de SOS PC QR.

### Información recopilada

| Componente | Datos |
|---|---|
| **CPU** | Fabricante, modelo, núcleos/hilos, frecuencia, temperatura, % uso |
| **RAM** | Capacidad total/usada/libre, tipo DDR, velocidad, módulos |
| **Almacenamiento** | Modelo, tipo (HDD/SSD/NVMe), capacidad, espacio libre, S.M.A.R.T., temperatura |
| **Sistema Operativo** | Nombre, versión, build, arquitectura, nombre del equipo, uptime |
| **Placa madre** | Fabricante, modelo, versión BIOS, fecha BIOS |
| **GPU** | Nombre, versión de controlador, VRAM, temperatura |
| **Sensores** | Todas las lecturas de temperatura y carga disponibles |

---

## Compilar

### Requisitos
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Windows 10/11 x64
- Visual Studio 2022 o VS Code (opcional)

### Pasos

```powershell
# En la carpeta DiagnosticoTool/
cd DiagnosticoTool
dotnet restore
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

El ejecutable se genera en:
```
DiagnosticoTool\bin\Release\net8.0-windows\win-x64\publish\DiagnosticoTool.exe
```

Coloca ese `.exe` en la carpeta `sos-pc-qr/DiagnosticoTool/` para que el botón de descarga funcione.

---

## Usar

1. Copia `DiagnosticoTool.exe` al equipo a diagnosticar (o ejecútala desde red local).
2. Clic derecho → **Ejecutar como administrador** (necesario para sensores de temperatura).
3. Presiona ENTER para confirmar.
4. El archivo `diagnostico.json` se guarda junto al ejecutable.
5. En SOS PC QR → **Diagnóstico del Sistema** → **Importar diagnóstico** → selecciona el JSON.

---

## Formato del JSON generado

```json
{
  "tool_version": "1.0",
  "timestamp": "2026-10-10T18:00:00Z",
  "cpu": {
    "manufacturer": "GenuineIntel",
    "name": "Intel Core i5-12400",
    "cores": 6,
    "threads": 12,
    "freq_ghz": 2.5,
    "temp_c": 52.0,
    "load_pct": 18.5
  },
  "ram": {
    "total_gb": 16.0,
    "used_gb": 9.2,
    "available_gb": 6.8,
    "type": "DDR4",
    "speed_mhz": 3200,
    "modules": [
      { "capacity_gb": 8.0, "type": "DDR4", "speed_mhz": 3200 },
      { "capacity_gb": 8.0, "type": "DDR4", "speed_mhz": 3200 }
    ]
  },
  "disks": [
    {
      "model": "Samsung SSD 870 EVO",
      "type": "SSD",
      "total_gb": 500.0,
      "free_gb": 210.0,
      "used_gb": 290.0,
      "temp_c": 38.0,
      "smart_status": "OK"
    }
  ],
  "os": {
    "name": "Microsoft Windows 11 Pro",
    "version": "10.0.22621",
    "build": "22621",
    "arch": "64-bit",
    "hostname": "LAB01-PC12",
    "last_boot": "2026-10-09 08:30:00",
    "uptime": "1d 9h 30m"
  },
  "motherboard": {
    "manufacturer": "ASUSTeK COMPUTER INC.",
    "model": "PRIME B660M-K D4",
    "bios_version": "1401",
    "bios_date": "2023-05-12"
  },
  "gpus": [
    {
      "name": "Intel UHD Graphics 730",
      "driver_version": "31.0.101.4575",
      "vram_mb": 1024,
      "temp_c": null
    }
  ],
  "sensors": [
    { "key": "cpu_cpu_package", "label": "CPU / CPU Package", "value": 52.0, "unit": "°C" }
  ]
}
```

---

## Seguridad y privacidad

- **Solo lectura**: no instala nada, no modifica el registro, no crea servicios.
- **No transmite datos**: toda la información queda en el archivo JSON local.
- **El técnico decide qué subir**: el JSON solo se envía a Supabase cuando el técnico hace clic en "Guardar diagnóstico".
- Requiere privilegios de administrador únicamente para acceder a los sensores de temperatura.

---

## Dependencias

| Paquete | Versión | Uso |
|---|---|---|
| `LibreHardwareMonitorLib` | 0.9.3 | Temperatura CPU/GPU/Disco, % de carga |
| `System.Management` (incluido en .NET Windows) | — | WMI para CPU, RAM, OS, Placa madre |
