import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Engineer keyword mapping for auto-assignment
const ENGINEER_KEYWORDS = [
  { name: 'RIDWAN', keywords: ['KADUNA', 'ZARIA'] },
  { name: 'PROSPER', keywords: ['ABIA', 'ABA ', ' ABA', 'UMUAHIA', 'ISIALA', 'EZIUKWU', 'CEM RD', 'FACTORY ROAD ABA', 'ABIA POLY'] },
  { name: 'DANIEL', keywords: ['ABUJA', 'NASARAWA', 'LAFIA', 'GWAGWALADA', 'KUBWA', 'GARKI', 'LIVE CAMP', 'UAC HOUSE', 'UNGWANRI', 'NNPCKAD', 'KADSU'] },
  { name: 'RAYMOND', keywords: ['ONITSHA', 'NNEWI', 'UKPOR', 'NKPOR', 'AWKA', 'AGULU', 'NWAORUBI', 'ONUEKE', 'HOSP ROAD', 'HOSPITAL RD'] },
  { name: 'LOUIS', keywords: ['BENUE', 'MAKURDI', 'GBOKO'] },
  { name: 'NONI', keywords: ['NSUKKA', 'UNN', 'UNEC', 'TRANS EKULU', 'AGBANI', 'INDEPEND LAYOUT', 'ENUGU 2', 'ENUGUSTATION', 'EBONYI ST UNI', 'ABAKALIKI'] },
  { name: 'MOSES', keywords: ['SOKOTO'] },
  { name: 'MARTIN', keywords: ['EBEANO ENUGU', 'FX MART ENUGU', 'ELECTRONIC MK', 'FAULK RD', 'ENUGU 2 ATM1'] },
  { name: 'PETER', keywords: ['KANO', 'HOTORO', 'KACHAKO', 'KANO MIN', 'BOMPAI', 'TUDUN', 'DAWAKI', 'ALLEN IKEJA', 'AWOLOWO IKEJA'] },
  { name: 'CHINOSO/NONSO', keywords: ['IMO', 'OWERRI', 'OKIGWE'] },
  { name: 'SAMUEL NGBEDE', keywords: ['PLATEAU', 'JOS', 'PANKSHIN', 'FARIN GADA', 'AKWANGA'] },
  { name: 'OSAS/STANLEY', keywords: ['BENIN', 'IKPOBA', 'UNIBEN', 'SAPELE', 'UGBOWO', 'AKPAKPAVA', 'MISSION RD', 'NEW BENIN', 'UROMI', 'UBIAJA', 'AFUZE', 'IRRUA', 'AFUSE', 'OZORRO', 'ABRAKA ERE', 'UNIBEN', 'SGBN'] },
  { name: 'DAVID', keywords: ['GOMBE', 'BILLIRI', 'AZARE', 'BAUCHI'] },
  { name: 'FERANMI', keywords: ['DELTA', 'WARRI', 'EFFURUN', 'UGHELLI', 'ABRAKA', 'ASABA', 'KWALE', 'AGBOR', 'ABRAKA ERE', 'OLEH'] },
  { name: 'RASHEED/SURAJ', keywords: ['KASTINA', 'KEFFI'] },
  { name: 'AYO/JERRY', keywords: ['MUSHIN', 'ISOLO', 'IKOTUN', 'KETU', 'OJOO', 'AKOWONJO', 'OJUWOYE', 'MAGODO', 'IKOTUN', 'EGBE', 'TROPICANA', 'OSHOGBO', 'SURULERE', 'OBALENDE ATM', 'EBUTTE METTA', 'EBUTE META', 'EBUTE METTA', 'EBUTTE METTA', 'EBUTTE METTA'] },
  { name: 'ABUTU', keywords: ['RUMOKORO', 'TRANS AMADI', 'WETHERAL', 'WEATHERAL', 'RUMO', 'IKWERRE', 'SHELL PH', 'GARRISON', 'OKPORO', 'AGIP JUNCTION', 'NCHIA', 'IGWURUTA', 'RIVERS SECT', 'RIVERS UNIV', 'UPTH', 'NBC PH', 'STANEL', 'MBARI', 'OIL MILL', 'FX MART PH', 'UNIPORT', 'ELELENWON', 'PH NAOC', 'NLNG', 'MERIDIEN', 'PH MAIN', 'ST SEC', 'HOSP ROAD', 'GOLF CLUB', 'RELIEF MKT', 'SCHLUMBERGER', 'ELEME', 'AGGREY', 'NBC', 'TRANS AMADI', 'YENAGOA ATM', 'FOT ONNE', 'SWALI', 'OBIAFU'] },
  { name: 'ANDREW/SAMUEL', keywords: ['APAPA', 'TIAMIYU', 'AJOSE', 'AWOLOWO ROAD', 'IKOYI', 'DPR VICTORIA', 'WAREHOUSE ROAD', 'SAFIX', 'LIVERPOOL ATM'] },
  { name: 'PAUL', keywords: ['YENAGOA ATM', 'YENAGOA ONSITE', 'APICO', 'UNIUYO', 'PBL OGUDU', 'GARRISON ONSITE', 'RIVERS UNIVERSITY', 'IKRD', 'EKET ATM', 'CALABAR', 'UYO ATM', 'UYO BRN'] },
  { name: 'JIDE', keywords: ['IBAFO', 'SANGOPOLY', 'AMUWO', 'OLORUNSOGO', 'MAZAMAZA', 'COLLEGE RD OGBA', 'ALUMINIUM VILLAGE', 'ILASA', 'NDU MINI', 'AKOKA', 'DALEKO', 'IDDO', 'SANGO'] },
  { name: 'NATHANIEL', keywords: ['BAYELSA', 'YENEGOA', 'NWANIBA', 'SWALI', 'EKET BO'] },
  { name: 'ADELEKE SIMEON', keywords: ['OYO', 'OSHOGBO', 'IKORODU', 'LEKKI', 'ILE EPO', 'MILE 12', 'IWO ROAD', 'BODIJA', 'MOKOLA', 'OGBOMOSHO', 'ADO EKITI', 'OBA ADESIDA', 'ODUTOLA', 'NEW ROAD DUTSE', 'MURTALA MOH', 'BOSSO', 'LOKOJA', 'AHMADU BELLO', 'SOKOTO MAIN', 'SOKOTO MARKET', 'OFFA', 'AKWANGA', 'PANKSHIN', 'BANNEX', 'JUNCTION RD', 'GWAGWALADA', 'TIAMIYU SAVAGE BRANCH', 'AZIKIWE', 'MAIGATARI', 'ANKPA', 'KABBA', 'EBONYI STATE UNI'] },
  { name: 'IKOTT', keywords: ['AKWA IBOM', 'IKOT ABASI', 'UYO', 'ORON', 'NWANIBA RD'] },
  { name: 'ASAFA HAKEEM', keywords: ['OSUN', 'KWARA', 'ILORIN', 'OFFA', 'OBA ADESIDA', 'OSHOGBO', 'ONDO', 'EKITI', 'OYEMEKUN', 'OSHOGBO BRANCH', 'ILARO', 'SAKI', 'IGBOKODA', 'OLU OBASANJO', 'OSOGBO', 'IKORODU BRANCH'] },
  { name: 'ADEYEMI', keywords: ['EKITI', 'SAKI', 'ONDO_ATM', 'ONDO ATM', 'ILARO', 'ADOEKITI', 'AKURE', 'IGBSECEM', 'ILORIN'] },
];

function autoAssign(text) {
  const upper = text.toUpperCase();
  for (const eng of ENGINEER_KEYWORDS) {
    if (eng.keywords.some(kw => upper.includes(kw))) return eng.name;
  }
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  // Process in small pages to avoid timeout - call multiple times
  const body = await req.json().catch(() => ({}));
  const skip = body.skip || 0;
  const limit = 60;

  const devices = await base44.asServiceRole.entities.BankDevice.list('created_date', limit, skip);
  let updated = 0;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (const device of devices) {
    const patches = {};
    if (!device.branch_name && device.device_name) patches.branch_name = device.device_name;
    if (!device.device_status) patches.device_status = 'Active';
    if (!device.sla_status) patches.sla_status = 'Normal';
    if (!device.device_category) patches.device_category = 'ATM';
    if (!device.assigned_engineer) {
      const text = `${device.device_name || ''} ${device.branch_name || ''}`;
      const eng = autoAssign(text);
      if (eng) patches.assigned_engineer = eng;
    }
    if (Object.keys(patches).length > 0) {
      await base44.asServiceRole.entities.BankDevice.update(device.id, patches);
      updated++;
      await sleep(50);
    }
  }

  return Response.json({ success: true, updated, fetched: devices.length, skip, hasMore: devices.length === limit });
});