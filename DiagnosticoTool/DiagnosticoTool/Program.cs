// ============================================================
// DiagnosticoTool — SOS PC QR
// Herramienta de diagnóstico de hardware para Windows 10/11
//
// ✅  Solo lectura — no instala servicios ni modifica Windows
// ✅  Usa WMI/CIM + LibreHardwareMonitorLib para sensores
// ✅  Genera diagnostico.json con datos reales del equipo
// ============================================================

using System.Management;
using System.Text.Json;
using System.Text.Json.Serialization;
using LibreHardwareMonitor.Hardware;

Console.Title = "SOS PC QR — DiagnosticoTool";
Console.OutputEncoding = System.Text.Encoding.UTF8;

Console.ForegroundColor = ConsoleColor.Green;
Console.WriteLine("╔══════════════════════════════════════════════════════╗");
Console.WriteLine("║          SOS PC QR — Herramienta de Diagnóstico      ║");
Console.WriteLine("║         IESTP Luis Negreiros Vega  ·  Solo Lectura   ║");
Console.WriteLine("╚══════════════════════════════════════════════════════╝");
Console.ResetColor();
Console.WriteLine();
Console.WriteLine("Esta herramienta recopila información de hardware del equipo.");
Console.WriteLine("No realiza cambios en Windows ni instala ningún componente.");
Console.WriteLine();
Console.Write("Presiona ENTER para continuar o Ctrl+C para cancelar... ");
Console.ReadLine();
Console.WriteLine();

// ── Recopilar datos ───────────────────────────────────────────
Console.Write("[1/7] Leyendo sensores de hardware (LibreHardwareMonitor)... ");
var sensors = HardwareSensors.Collect();
Console.WriteLine("OK");

Console.Write("[2/7] Procesador... ");
var cpu = WmiHelper.GetCpu(sensors);
Console.WriteLine(cpu?.Name ?? "N/D");

Console.Write("[3/7] Memoria RAM... ");
var ram = WmiHelper.GetRam();
Console.WriteLine(ram?.TotalGb.HasValue == true ? $"{ram.TotalGb:0} GB" : "N/D");

Console.Write("[4/7] Almacenamiento... ");
var disks = WmiHelper.GetDisks(sensors);
Console.WriteLine($"{disks.Count} disco(s)");

Console.Write("[5/7] Sistema Operativo... ");
var os = WmiHelper.GetOs();
Console.WriteLine(os?.Name ?? "N/D");

Console.Write("[6/7] Placa madre... ");
var mb = WmiHelper.GetMotherboard();
Console.WriteLine(mb?.Model ?? "N/D");

Console.Write("[7/7] Tarjeta gráfica... ");
var gpus = WmiHelper.GetGpus(sensors);
Console.WriteLine($"{gpus.Count} GPU(s)");

// ── Construir objeto de salida ────────────────────────────────
var result = new DiagResult
{
    ToolVersion  = "1.0",
    Timestamp    = DateTime.UtcNow.ToString("o"),
    Cpu          = cpu,
    Ram          = ram,
    Disks        = disks,
    Os           = os,
    Motherboard  = mb,
    Gpus         = gpus,
    Sensors      = sensors.AllReadings,
};

// ── Guardar JSON ──────────────────────────────────────────────
var opts = new JsonSerializerOptions
{
    WriteIndented = true,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
};

var outDir  = AppContext.BaseDirectory;
var outPath = Path.Combine(outDir, "diagnostico.json");
var json    = JsonSerializer.Serialize(result, opts);
File.WriteAllText(outPath, json);

Console.WriteLine();
Console.ForegroundColor = ConsoleColor.Green;
Console.WriteLine($"✅ Diagnóstico guardado en:");
Console.ForegroundColor = ConsoleColor.White;
Console.WriteLine($"   {outPath}");
Console.ResetColor();
Console.WriteLine();
Console.WriteLine("Importa este archivo en SOS PC QR › Diagnóstico del Sistema.");
Console.WriteLine();
Console.Write("Presiona ENTER para salir... ");
Console.ReadLine();

// ══════════════════════════════════════════════════════════════
// Modelos de datos
// ══════════════════════════════════════════════════════════════

public class DiagResult
{
    public string? ToolVersion  { get; set; }
    public string? Timestamp    { get; set; }
    public CpuInfo?     Cpu     { get; set; }
    public RamInfo?     Ram     { get; set; }
    public List<DiskInfo>  Disks { get; set; } = new();
    public OsInfo?      Os      { get; set; }
    public MoboInfo?    Motherboard { get; set; }
    public List<GpuInfo>   Gpus  { get; set; } = new();
    public List<SensorReading> Sensors { get; set; } = new();
}

public class CpuInfo
{
    public string?  Manufacturer { get; set; }
    public string?  Name         { get; set; }
    public int?     Cores        { get; set; }
    public int?     Threads      { get; set; }
    public double?  FreqGhz      { get; set; }
    public double?  TempC        { get; set; }
    public double?  LoadPct      { get; set; }
}

public class RamModule
{
    public double?  CapacityGb  { get; set; }
    public string?  Type        { get; set; }
    public int?     SpeedMhz    { get; set; }
    public string?  Manufacturer { get; set; }
}

public class RamInfo
{
    public double?  TotalGb     { get; set; }
    public double?  UsedGb      { get; set; }
    public double?  AvailableGb { get; set; }
    public string?  Type        { get; set; }
    public int?     SpeedMhz    { get; set; }
    public List<RamModule> Modules { get; set; } = new();
}

public class DiskInfo
{
    public string?  Name        { get; set; }
    public string?  Model       { get; set; }
    public string?  Type        { get; set; }   // HDD | SSD | NVMe
    public double?  TotalGb     { get; set; }
    public double?  UsedGb      { get; set; }
    public double?  FreeGb      { get; set; }
    public double?  TempC       { get; set; }
    public string?  SmartStatus { get; set; }   // OK | WARN | FAIL | N/A
}

public class OsInfo
{
    public string? Name      { get; set; }
    public string? Version   { get; set; }
    public string? Build     { get; set; }
    public string? Arch      { get; set; }
    public string? Hostname  { get; set; }
    public string? LastBoot  { get; set; }
    public string? Uptime    { get; set; }
}

public class MoboInfo
{
    public string? Manufacturer     { get; set; }
    public string? Model            { get; set; }
    public string? Version          { get; set; }
    public string? BiosVersion      { get; set; }
    public string? BiosDate         { get; set; }
    public string? BiosManufacturer { get; set; }
}

public class GpuInfo
{
    public string? Name          { get; set; }
    public string? DriverVersion { get; set; }
    public int?    VramMb        { get; set; }
    public double? TempC         { get; set; }
}

public class SensorReading
{
    public string? Key   { get; set; }
    public string? Label { get; set; }
    public double  Value { get; set; }
    public string? Unit  { get; set; }
}

// ══════════════════════════════════════════════════════════════
// Clase que gestiona LibreHardwareMonitor
// ══════════════════════════════════════════════════════════════
public class HardwareSensors : IDisposable
{
    private readonly Computer _computer;
    public List<SensorReading> AllReadings { get; } = new();

    // Valores indexados para uso rápido
    public Dictionary<HardwareType, List<ISensor>> SensorsByHw { get; } = new();

    private HardwareSensors()
    {
        _computer = new Computer
        {
            IsCpuEnabled         = true,
            IsGpuEnabled         = true,
            IsMemoryEnabled      = true,
            IsMotherboardEnabled = true,
            IsStorageEnabled     = true,
            IsNetworkEnabled     = false,
            IsControllerEnabled  = false,
            IsBatteryEnabled     = false,
            IsPsuEnabled         = false,
        };

        try
        {
            _computer.Open();
            _computer.Accept(new UpdateVisitor());

            foreach (var hw in _computer.Hardware)
            {
                CollectSensors(hw);
                foreach (var sub in hw.SubHardware)
                    CollectSensors(sub);
            }
        }
        catch
        {
            // Si no hay permisos de administrador algunos sensores no estarán disponibles
        }
    }

    private void CollectSensors(IHardware hw)
    {
        if (!SensorsByHw.ContainsKey(hw.HardwareType))
            SensorsByHw[hw.HardwareType] = new();

        foreach (var s in hw.Sensors)
        {
            SensorsByHw[hw.HardwareType].Add(s);
            if (s.Value.HasValue && (s.SensorType == SensorType.Temperature || s.SensorType == SensorType.Load))
            {
                var unit = s.SensorType == SensorType.Temperature ? "°C" : "%";
                AllReadings.Add(new SensorReading
                {
                    Key   = $"{hw.HardwareType}_{s.Name}".ToLower().Replace(" ", "_"),
                    Label = $"{hw.Name} / {s.Name}",
                    Value = Math.Round((double)s.Value!, 1),
                    Unit  = unit,
                });
            }
        }
    }

    public double? Get(HardwareType hwType, SensorType sType, string nameContains)
    {
        if (!SensorsByHw.TryGetValue(hwType, out var list)) return null;
        var s = list.FirstOrDefault(x =>
            x.SensorType == sType &&
            x.Name.Contains(nameContains, StringComparison.OrdinalIgnoreCase));
        return s?.Value.HasValue == true ? Math.Round((double)s.Value!, 1) : null;
    }

    public static HardwareSensors Collect() => new HardwareSensors();

    public void Dispose()
    {
        try { _computer.Close(); } catch { }
    }

    private class UpdateVisitor : IVisitor
    {
        public void VisitComputer(IComputer computer)
        {
            computer.Traverse(this);
        }
        public void VisitHardware(IHardware hardware)
        {
            hardware.Update();
            foreach (var sub in hardware.SubHardware)
                sub.Update();
        }
        public void VisitSensor(ISensor sensor) { }
        public void VisitParameter(IParameter parameter) { }
    }
}

// ══════════════════════════════════════════════════════════════
// Helpers WMI / CIM
// ══════════════════════════════════════════════════════════════
public static class WmiHelper
{
    // ── CPU ──────────────────────────────────────────────────
    public static CpuInfo? GetCpu(HardwareSensors sensors)
    {
        try
        {
            using var mos = new ManagementObjectSearcher(
                "SELECT * FROM Win32_Processor");
            foreach (ManagementObject mo in mos.Get())
            {
                var name   = mo["Name"]?.ToString()?.Trim();
                var manuf  = mo["Manufacturer"]?.ToString()?.Trim();
                var cores  = mo["NumberOfCores"] is uint c ? (int?)c : null;
                var threads= mo["NumberOfLogicalProcessors"] is uint t ? (int?)t : null;
                var freqMhz= mo["MaxClockSpeed"] is uint f ? (double?)f : null;

                // Temperatura y carga desde LibreHardwareMonitor
                var temp = sensors.Get(HardwareType.Cpu, SensorType.Temperature, "Package")
                        ?? sensors.Get(HardwareType.Cpu, SensorType.Temperature, "CPU");
                var load = sensors.Get(HardwareType.Cpu, SensorType.Load, "Total")
                        ?? sensors.Get(HardwareType.Cpu, SensorType.Load, "CPU");

                return new CpuInfo
                {
                    Manufacturer = manuf,
                    Name         = name,
                    Cores        = cores,
                    Threads      = threads,
                    FreqGhz      = freqMhz.HasValue ? Math.Round(freqMhz.Value / 1000.0, 2) : null,
                    TempC        = temp,
                    LoadPct      = load,
                };
            }
        }
        catch { }
        return null;
    }

    // ── RAM ──────────────────────────────────────────────────
    public static RamInfo? GetRam()
    {
        var info = new RamInfo();
        try
        {
            // Módulos físicos (Win32_PhysicalMemory)
            using var mosMem = new ManagementObjectSearcher(
                "SELECT Capacity,Speed,MemoryType,SMBIOSMemoryType,Manufacturer FROM Win32_PhysicalMemory");
            foreach (ManagementObject mo in mosMem.Get())
            {
                var cap = mo["Capacity"] is ulong capVal ? capVal / (1024.0 * 1024.0 * 1024.0) : (double?)null;
                var spd = mo["Speed"] is uint s ? (int?)s : null;
                var manuf = mo["Manufacturer"]?.ToString()?.Trim();

                // Tipo de memoria: SMBIOSMemoryType es más preciso
                var memType = mo["SMBIOSMemoryType"] is uint mt ? mt :
                              mo["MemoryType"] is uint mt2 ? mt2 : 0u;
                var typeName = memType switch
                {
                    20 => "DDR",
                    21 => "DDR2",
                    24 => "DDR3",
                    26 => "DDR4",
                    34 => "DDR5",
                    _  => null,
                };

                if (typeName != null && info.Type == null) info.Type = typeName;
                if (spd.HasValue && info.SpeedMhz == null) info.SpeedMhz = spd;

                info.Modules.Add(new RamModule
                {
                    CapacityGb   = cap.HasValue ? Math.Round(cap.Value, 1) : null,
                    Type         = typeName,
                    SpeedMhz     = spd,
                    Manufacturer = manuf,
                });
            }

            // Uso de RAM (Win32_OperatingSystem)
            using var mosOs = new ManagementObjectSearcher(
                "SELECT TotalVisibleMemorySize,FreePhysicalMemory FROM Win32_OperatingSystem");
            foreach (ManagementObject mo in mosOs.Get())
            {
                var total = mo["TotalVisibleMemorySize"] is ulong tot ? tot / (1024.0 * 1024.0) : (double?)null;
                var free  = mo["FreePhysicalMemory"]     is ulong fre ? fre / (1024.0 * 1024.0) : (double?)null;

                info.TotalGb     = total.HasValue ? Math.Round(total.Value, 1) : null;
                info.AvailableGb = free.HasValue  ? Math.Round(free.Value,  1) : null;
                info.UsedGb = (info.TotalGb.HasValue && info.AvailableGb.HasValue)
                    ? Math.Round(info.TotalGb.Value - info.AvailableGb.Value, 1)
                    : null;
            }
        }
        catch { }

        return info.Modules.Count > 0 || info.TotalGb.HasValue ? info : null;
    }

    // ── Discos ───────────────────────────────────────────────
    public static List<DiskInfo> GetDisks(HardwareSensors sensors)
    {
        var disks = new List<DiskInfo>();
        try
        {
            // Win32_DiskDrive para modelos y tipo
            using var mosDrive = new ManagementObjectSearcher(
                "SELECT DeviceID,Model,MediaType,Size FROM Win32_DiskDrive");
            var drives = new Dictionary<string, ManagementObject>();
            foreach (ManagementObject mo in mosDrive.Get())
            {
                var devId = mo["DeviceID"]?.ToString() ?? "";
                drives[devId] = mo;
            }

            // Win32_LogicalDisk para espacio libre
            using var mosLogic = new ManagementObjectSearcher(
                "SELECT DeviceID,Size,FreeSpace,DriveType FROM Win32_LogicalDisk WHERE DriveType=3");
            foreach (ManagementObject ld in mosLogic.Get())
            {
                var totalBytes = ld["Size"]      is ulong tb ? tb : 0UL;
                var freeBytes  = ld["FreeSpace"] is ulong fb ? fb : 0UL;

                var disk = new DiskInfo
                {
                    TotalGb = totalBytes > 0 ? Math.Round(totalBytes / 1e9, 1) : null,
                    FreeGb  = freeBytes  > 0 ? Math.Round(freeBytes  / 1e9, 1) : null,
                };
                if (disk.TotalGb.HasValue && disk.FreeGb.HasValue)
                    disk.UsedGb = Math.Round(disk.TotalGb.Value - disk.FreeGb.Value, 1);

                // Buscar modelo del disco físico correspondiente
                // (asignamos el primero disponible si solo hay uno)
                if (drives.Count > 0)
                {
                    var drv = drives.Values.First();
                    disk.Model = drv["Model"]?.ToString()?.Trim();
                    disk.Name  = disk.Model;
                    var media  = drv["MediaType"]?.ToString() ?? "";
                    disk.Type = DetermineDiskType(media, disk.Model ?? "");
                }
                else
                {
                    disk.Name = ld["DeviceID"]?.ToString();
                }

                // S.M.A.R.T. (básico mediante MSStorageDriver_FailurePredictStatus)
                disk.SmartStatus = GetSmartStatus(disk.Model);

                // Temperatura desde LibreHardwareMonitor
                disk.TempC = sensors.Get(HardwareType.Storage, SensorType.Temperature, "");

                disks.Add(disk);
            }
        }
        catch { }
        return disks;
    }

    private static string DetermineDiskType(string mediaType, string model)
    {
        var m = model.ToUpper();
        if (m.Contains("NVME") || m.Contains("NVM")) return "NVMe";
        if (m.Contains("SSD"))  return "SSD";
        if (mediaType.Contains("Solid", StringComparison.OrdinalIgnoreCase)) return "SSD";
        if (mediaType.Contains("Fixed", StringComparison.OrdinalIgnoreCase)) return "HDD";
        return "HDD";
    }

    private static string GetSmartStatus(string? model)
    {
        try
        {
            using var scope = new ManagementScope(@"\root\wmi");
            scope.Connect();
            using var query = new ManagementObjectSearcher(scope,
                new ObjectQuery("SELECT PredictFailure FROM MSStorageDriver_FailurePredictStatus"));
            foreach (ManagementObject mo in query.Get())
            {
                var predict = mo["PredictFailure"] is bool b ? b : false;
                return predict ? "WARN" : "OK";
            }
        }
        catch { }
        return "N/A";
    }

    // ── Sistema Operativo ────────────────────────────────────
    public static OsInfo? GetOs()
    {
        try
        {
            using var mos = new ManagementObjectSearcher(
                "SELECT Caption,Version,BuildNumber,OSArchitecture,LastBootUpTime,CSName FROM Win32_OperatingSystem");
            foreach (ManagementObject mo in mos.Get())
            {
                var lastBootRaw = mo["LastBootUpTime"]?.ToString();
                DateTime? lastBoot = null;
                TimeSpan? uptime   = null;
                if (lastBootRaw != null)
                {
                    try
                    {
                        lastBoot = ManagementDateTimeConverter.ToDateTime(lastBootRaw);
                        uptime   = DateTime.Now - lastBoot.Value;
                    }
                    catch { }
                }

                return new OsInfo
                {
                    Name     = mo["Caption"]?.ToString()?.Trim(),
                    Version  = mo["Version"]?.ToString()?.Trim(),
                    Build    = mo["BuildNumber"]?.ToString()?.Trim(),
                    Arch     = mo["OSArchitecture"]?.ToString()?.Trim(),
                    Hostname = mo["CSName"]?.ToString()?.Trim(),
                    LastBoot = lastBoot?.ToString("yyyy-MM-dd HH:mm:ss"),
                    Uptime   = uptime.HasValue
                        ? $"{(int)uptime.Value.TotalDays}d {uptime.Value.Hours}h {uptime.Value.Minutes}m"
                        : null,
                };
            }
        }
        catch { }
        return null;
    }

    // ── Placa madre ──────────────────────────────────────────
    public static MoboInfo? GetMotherboard()
    {
        var info = new MoboInfo();
        try
        {
            using var mosBoard = new ManagementObjectSearcher(
                "SELECT Manufacturer,Product,Version FROM Win32_BaseBoard");
            foreach (ManagementObject mo in mosBoard.Get())
            {
                info.Manufacturer = mo["Manufacturer"]?.ToString()?.Trim();
                info.Model        = mo["Product"]?.ToString()?.Trim();
                info.Version      = mo["Version"]?.ToString()?.Trim();
            }

            using var mosBios = new ManagementObjectSearcher(
                "SELECT SMBIOSBIOSVersion,ReleaseDate,Manufacturer FROM Win32_BIOS");
            foreach (ManagementObject mo in mosBios.Get())
            {
                info.BiosVersion      = mo["SMBIOSBIOSVersion"]?.ToString()?.Trim();
                info.BiosManufacturer = mo["Manufacturer"]?.ToString()?.Trim();
                var dateRaw = mo["ReleaseDate"]?.ToString();
                if (dateRaw != null)
                {
                    try
                    {
                        var dt = ManagementDateTimeConverter.ToDateTime(dateRaw);
                        info.BiosDate = dt.ToString("yyyy-MM-dd");
                    }
                    catch { info.BiosDate = dateRaw; }
                }
            }
        }
        catch { }

        return info.Manufacturer != null || info.Model != null ? info : null;
    }

    // ── GPU ──────────────────────────────────────────────────
    public static List<GpuInfo> GetGpus(HardwareSensors sensors)
    {
        var gpus = new List<GpuInfo>();
        try
        {
            using var mos = new ManagementObjectSearcher(
                "SELECT Name,DriverVersion,AdapterRAM FROM Win32_VideoController WHERE PNPDeviceID NOT LIKE 'ROOT%'");
            foreach (ManagementObject mo in mos.Get())
            {
                var name  = mo["Name"]?.ToString()?.Trim();
                var vram  = mo["AdapterRAM"] is uint v ? (int?)(v / (1024 * 1024)) : null;
                var drv   = mo["DriverVersion"]?.ToString()?.Trim();

                // Temperatura GPU desde LibreHardwareMonitor
                double? temp = null;
                foreach (var hwType in new[] { HardwareType.GpuNvidia, HardwareType.GpuAmd, HardwareType.GpuIntel })
                {
                    temp = sensors.Get(hwType, SensorType.Temperature, "GPU");
                    if (temp.HasValue) break;
                }

                gpus.Add(new GpuInfo
                {
                    Name          = name,
                    DriverVersion = drv,
                    VramMb        = vram,
                    TempC         = temp,
                });
            }
        }
        catch { }
        return gpus;
    }
}
