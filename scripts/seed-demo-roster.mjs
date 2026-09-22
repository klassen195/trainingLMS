/**
 * Seed Demo department: 6 stations, fleet, and a 100-person roster.
 * Usage: node scripts/seed-demo-roster.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEMO_CLIENT_ID = "73fde9c6-2e03-45ee-bc29-dc425c43ec76";

function loadEnv() {
  const text = readFileSync(resolve(ROOT, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FIRST_NAMES = [
  "James", "Maria", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Raymond", "Christine", "Gregory", "Debra",
  "Frank", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Catherine",
  "Dennis", "Olivia", "Jerry", "Heather", "Tyler", "Diane", "Aaron", "Julie",
];

const LAST_NAMES = [
  "Anderson", "Baker", "Bennett", "Brooks", "Campbell", "Carter", "Clark", "Collins",
  "Cooper", "Cox", "Davis", "Edwards", "Evans", "Foster", "Garcia", "Gonzalez",
  "Gray", "Green", "Hall", "Harris", "Hayes", "Henderson", "Hernandez", "Hill",
  "Howard", "Hughes", "Jackson", "James", "Jenkins", "Johnson", "Jones", "Kelly",
  "Kennedy", "King", "Lee", "Lewis", "Long", "Lopez", "Martin", "Martinez",
  "Miller", "Mitchell", "Moore", "Morgan", "Morris", "Murphy", "Nelson", "Nguyen",
  "Ortiz", "Owen", "Parker", "Patterson", "Perez", "Perry", "Peterson", "Phillips",
  "Powell", "Price", "Ramirez", "Reed", "Reynolds", "Richards", "Rivera", "Roberts",
  "Robinson", "Rodriguez", "Rogers", "Ross", "Russell", "Sanchez", "Sanders", "Scott",
  "Shaw", "Simmons", "Smith", "Stewart", "Sullivan", "Taylor", "Thomas", "Thompson",
  "Torres", "Turner", "Walker", "Ward", "Watson", "White", "Williams", "Wilson",
  "Wood", "Wright", "Young", "Adams", "Allen", "Bailey", "Bell", "Butler",
  "Coleman", "Cook", "Diaz", "Flores", "Griffin", "Hamilton", "Harper", "Hunt",
];

function slug(first, last) {
  return `${first}.${last}`
    .toLowerCase()
    .replace(/[^a-z.]+/g, "")
    .replace(/\.+/g, ".");
}

function throwOnError(label, error) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function ensureStations() {
  const stationNames = [
    "Station 1",
    "Station 2",
    "Station 3",
    "Station 4",
    "Station 5",
    "Station 6",
  ];

  const { data: existing, error: listError } = await admin
    .from("locations")
    .select("id, name, sort_order")
    .eq("client_id", DEMO_CLIENT_ID);
  throwOnError("list locations", listError);

  const byName = new Map((existing ?? []).map((row) => [row.name, row]));
  for (let i = 0; i < stationNames.length; i++) {
    const name = stationNames[i];
    if (byName.has(name)) continue;
    const { data, error } = await admin
      .from("locations")
      .insert({
        client_id: DEMO_CLIENT_ID,
        name,
        sort_order: i + 1,
        is_active: true,
        include_in_shift_plan: name !== "Station 6",
        notes: name === "Station 6"
          ? "Administration / HQ"
          : name === "Station 5"
            ? "Training / relief / administrative support"
            : "",
      })
      .select("id, name")
      .single();
    throwOnError(`create ${name}`, error);
    byName.set(name, data);
  }

  const { data: all, error } = await admin
    .from("locations")
    .select("id, name")
    .eq("client_id", DEMO_CLIENT_ID)
    .order("sort_order");
  throwOnError("reload locations", error);
  return Object.fromEntries((all ?? []).map((row) => [row.name, row.id]));
}

async function ensureApparatus(stations) {
  const units = [
    { unit_number: "E1", apparatus_type: "engine", station: "Station 1", build_number: "DEMO-E1", fleet_card_sort: 10 },
    { unit_number: "L1", apparatus_type: "ladder", station: "Station 1", build_number: "DEMO-L1", fleet_card_sort: 11 },
    { unit_number: "M1", apparatus_type: "ambulance", station: "Station 1", build_number: "DEMO-M1", fleet_card_sort: 12 },
    { unit_number: "BC1", apparatus_type: "other", station: "Station 1", build_number: "DEMO-BC1", fleet_card_sort: 13 },
    { unit_number: "E2", apparatus_type: "engine", station: "Station 2", build_number: "DEMO-E2", fleet_card_sort: 20 },
    { unit_number: "M2", apparatus_type: "ambulance", station: "Station 2", build_number: "DEMO-M2", fleet_card_sort: 21 },
    { unit_number: "E3", apparatus_type: "engine", station: "Station 3", build_number: "DEMO-E3", fleet_card_sort: 30 },
    { unit_number: "L2", apparatus_type: "ladder", station: "Station 3", build_number: "DEMO-L2", fleet_card_sort: 31 },
    { unit_number: "E4", apparatus_type: "engine", station: "Station 4", build_number: "DEMO-E4", fleet_card_sort: 40 },
    { unit_number: "M3", apparatus_type: "ambulance", station: "Station 4", build_number: "DEMO-M3", fleet_card_sort: 41 },
  ];

  const { data: existing, error: listError } = await admin
    .from("assets")
    .select("id, build_number, unit_number")
    .eq("client_id", DEMO_CLIENT_ID)
    .eq("kind", "apparatus");
  throwOnError("list apparatus", listError);
  const byBuild = new Set((existing ?? []).map((row) => row.build_number));

  for (const unit of units) {
    if (byBuild.has(unit.build_number)) continue;
    const { error } = await admin.from("assets").insert({
      client_id: DEMO_CLIENT_ID,
      kind: "apparatus",
      name: null,
      status: "in_service",
      unit_number: unit.unit_number,
      apparatus_type: unit.apparatus_type,
      station: unit.station,
      build_number: unit.build_number,
      show_on_fleet_cards: true,
      fleet_card_sort: unit.fleet_card_sort,
      notes: "",
    });
    throwOnError(`create ${unit.unit_number}`, error);
  }

  return units;
}

function buildRoster(stations) {
  /** @type {Array<{
   *  firstName: string;
   *  lastName: string;
   *  rank: string | null;
   *  jobTitle: string | null;
   *  shift: 'red'|'blue'|'green'|'white'|null;
   *  stationName: string | null;
   *  permission: 'Recruit'|'Firefighter'|'Captain';
   *  apparatus: string | null;
   * }>} */
  const people = [];
  let nameIndex = 0;

  function nextName() {
    const firstName = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
    const lastName =
      LAST_NAMES[(nameIndex * 7 + Math.floor(nameIndex / FIRST_NAMES.length)) % LAST_NAMES.length];
    nameIndex += 1;
    return { firstName, lastName };
  }

  const shifts = /** @type {const} */ (["red", "blue", "green"]);

  /** Line seats that fill the 10 apparatus on each shift (31 × 3 = 93). */
  const lineSeats = [
    // Station 1
    { station: "Station 1", apparatus: "E1", rank: "Captain", title: "Captain — Engine 1", permission: "Captain" },
    { station: "Station 1", apparatus: "E1", rank: "Engineer", title: "Engineer — Engine 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "E1", rank: "Firefighter", title: "Firefighter — Engine 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "E1", rank: "Firefighter", title: "Firefighter — Engine 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "L1", rank: "Captain", title: "Captain — Ladder 1", permission: "Captain" },
    { station: "Station 1", apparatus: "L1", rank: "Engineer", title: "Engineer — Ladder 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "L1", rank: "Firefighter", title: "Firefighter — Ladder 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "L1", rank: "Firefighter", title: "Firefighter — Ladder 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "M1", rank: "Firefighter", title: "Firefighter — Medic 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "M1", rank: "Firefighter", title: "Firefighter — Medic 1", permission: "Firefighter" },
    { station: "Station 1", apparatus: "BC1", rank: "Battalion Chief", title: "Battalion Chief — BC1", permission: "Captain" },
    // Station 2
    { station: "Station 2", apparatus: "E2", rank: "Captain", title: "Captain — Engine 2", permission: "Captain" },
    { station: "Station 2", apparatus: "E2", rank: "Engineer", title: "Engineer — Engine 2", permission: "Firefighter" },
    { station: "Station 2", apparatus: "E2", rank: "Firefighter", title: "Firefighter — Engine 2", permission: "Firefighter" },
    { station: "Station 2", apparatus: "E2", rank: "Firefighter", title: "Firefighter — Engine 2", permission: "Firefighter" },
    { station: "Station 2", apparatus: "M2", rank: "Firefighter", title: "Firefighter — Medic 2", permission: "Firefighter" },
    { station: "Station 2", apparatus: "M2", rank: "Firefighter", title: "Firefighter — Medic 2", permission: "Firefighter" },
    // Station 3
    { station: "Station 3", apparatus: "E3", rank: "Captain", title: "Captain — Engine 3", permission: "Captain" },
    { station: "Station 3", apparatus: "E3", rank: "Engineer", title: "Engineer — Engine 3", permission: "Firefighter" },
    { station: "Station 3", apparatus: "E3", rank: "Firefighter", title: "Firefighter — Engine 3", permission: "Firefighter" },
    { station: "Station 3", apparatus: "E3", rank: "Firefighter", title: "Firefighter — Engine 3", permission: "Firefighter" },
    { station: "Station 3", apparatus: "L2", rank: "Captain", title: "Captain — Ladder 2", permission: "Captain" },
    { station: "Station 3", apparatus: "L2", rank: "Engineer", title: "Engineer — Ladder 2", permission: "Firefighter" },
    { station: "Station 3", apparatus: "L2", rank: "Firefighter", title: "Firefighter — Ladder 2", permission: "Firefighter" },
    { station: "Station 3", apparatus: "L2", rank: "Firefighter", title: "Firefighter — Ladder 2", permission: "Firefighter" },
    // Station 4
    { station: "Station 4", apparatus: "E4", rank: "Captain", title: "Captain — Engine 4", permission: "Captain" },
    { station: "Station 4", apparatus: "E4", rank: "Engineer", title: "Engineer — Engine 4", permission: "Firefighter" },
    { station: "Station 4", apparatus: "E4", rank: "Firefighter", title: "Firefighter — Engine 4", permission: "Firefighter" },
    // One Engine 4 firefighter seat is a Station 5 relief firefighter (per shift)
    { station: "Station 5", apparatus: null, rank: "Firefighter", title: "Relief Firefighter — Station 5", permission: "Firefighter" },
    { station: "Station 4", apparatus: "M3", rank: "Firefighter", title: "Firefighter — Medic 3", permission: "Firefighter" },
    { station: "Station 4", apparatus: "M3", rank: "Firefighter", title: "Firefighter — Medic 3", permission: "Firefighter" },
  ];

  for (const shift of shifts) {
    for (const seat of lineSeats) {
      const { firstName, lastName } = nextName();
      people.push({
        firstName,
        lastName,
        rank: seat.rank,
        jobTitle: seat.title,
        shift,
        stationName: seat.station,
        permission: seat.permission,
        apparatus: seat.apparatus,
      });
    }
  }

  // Administrative — Fire Chief at HQ (Station 6); support staff at Station 5
  const adminSeats = [
    { rank: "Fire Chief", title: "Fire Chief", permission: "Captain", station: "Station 6" },
    { rank: "Assistant Chief", title: "Assistant Chief — Operations", permission: "Captain", station: "Station 5" },
    { rank: "Administration", title: "Training Officer", permission: "Captain", station: "Station 5" },
  ];
  for (const seat of adminSeats) {
    const { firstName, lastName } = nextName();
    people.push({
      firstName,
      lastName,
      rank: seat.rank,
      jobTitle: seat.title,
      shift: "white",
      stationName: seat.station,
      permission: seat.permission,
      apparatus: null,
    });
  }

  // 4 unassigned recruits
  for (let i = 0; i < 4; i++) {
    const { firstName, lastName } = nextName();
    people.push({
      firstName,
      lastName,
      rank: "Firefighter",
      jobTitle: "Recruit — Unassigned",
      shift: null,
      stationName: null,
      permission: "Recruit",
      apparatus: null,
    });
  }

  if (people.length !== 100) {
    throw new Error(`Expected 100 people, built ${people.length}`);
  }

  // Ensure station map is used (validation)
  for (const person of people) {
    if (person.stationName && !stations[person.stationName]) {
      throw new Error(`Missing station ${person.stationName}`);
    }
  }

  return people;
}

async function loadPermissionLevels() {
  const { data, error } = await admin
    .from("permission_levels")
    .select("id, name")
    .eq("client_id", DEMO_CLIENT_ID);
  throwOnError("permission levels", error);
  const map = Object.fromEntries((data ?? []).map((row) => [row.name, row.id]));
  for (const required of ["Recruit", "Firefighter", "Captain"]) {
    if (!map[required]) throw new Error(`Missing permission level: ${required}`);
  }
  return map;
}

async function setPermissionLevel(profileId, clientId, levelId) {
  const { data: existing, error: existingError } = await admin
    .from("profile_permission_levels")
    .select("permission_level_id")
    .eq("profile_id", profileId);
  throwOnError("list profile levels", existingError);

  const current = new Set((existing ?? []).map((row) => row.permission_level_id));
  if (!current.has(levelId)) {
    const { error } = await admin.from("profile_permission_levels").insert({
      profile_id: profileId,
      permission_level_id: levelId,
      client_id: clientId,
    });
    throwOnError("insert permission level", error);
  }
  const toDelete = [...current].filter((id) => id !== levelId);
  if (toDelete.length) {
    const { error } = await admin
      .from("profile_permission_levels")
      .delete()
      .eq("profile_id", profileId)
      .in("permission_level_id", toDelete);
    throwOnError("delete extra permission levels", error);
  }
}

async function createOrUpdatePerson(person, index, stations, levels) {
  const employeeNumber = `DEMO-${String(index + 1).padStart(3, "0")}`;
  const emailBase = slug(person.firstName, person.lastName);
  const email = `${emailBase}.${employeeNumber.toLowerCase()}@demo.training-lms.local`;
  const displayName = `${person.firstName} ${person.lastName}`;
  const locationId = person.stationName ? stations[person.stationName] : null;
  const levelId = levels[person.permission];

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("client_id", DEMO_CLIENT_ID)
    .eq("employee_number", employeeNumber)
    .maybeSingle();

  let userId = existingProfile?.id ?? null;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { client_id: DEMO_CLIENT_ID },
      user_metadata: {
        client_id: DEMO_CLIENT_ID,
        first_name: person.firstName,
        last_name: person.lastName,
        display_name: displayName,
      },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        const { data: byEmail } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (!byEmail) throw new Error(`User exists for ${email} but no profile found`);
        userId = byEmail.id;
      } else {
        throw new Error(`createUser ${email}: ${error.message}`);
      }
    } else {
      userId = data.user.id;
    }
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      display_name: displayName,
      first_name: person.firstName,
      last_name: person.lastName,
      email,
      client_id: DEMO_CLIENT_ID,
      rank: person.rank,
      job_title: person.jobTitle,
      department: "Demo",
      employee_number: employeeNumber,
      shift: person.shift,
      primary_location_id: locationId,
      is_active: true,
      hire_date: "2024-01-15",
    })
    .eq("id", userId);
  throwOnError(`update profile ${email}`, updateError);

  await setPermissionLevel(userId, DEMO_CLIENT_ID, levelId);

  return {
    id: userId,
    email,
    employeeNumber,
    rank: person.rank,
    shift: person.shift,
    stationName: person.stationName,
    apparatus: person.apparatus,
  };
}

async function assignSupervisors(created) {
  // Captains supervise their apparatus crew; BC supervises captains on the same shift.
  const byShiftApparatus = new Map();
  for (const person of created) {
    if (!person.shift || !person.apparatus) continue;
    const key = `${person.shift}:${person.apparatus}`;
    const list = byShiftApparatus.get(key) ?? [];
    list.push(person);
    byShiftApparatus.set(key, list);
  }

  for (const [, crew] of byShiftApparatus) {
    const captain = crew.find((p) => p.rank === "Captain");
    const bc = created.find(
      (p) => p.rank === "Battalion Chief" && p.shift === crew[0].shift
    );
    for (const member of crew) {
      let supervisorId = null;
      if (member.rank === "Battalion Chief") {
        const chief = created.find((p) => p.rank === "Fire Chief");
        supervisorId = chief?.id ?? null;
      } else if (member.rank === "Captain") {
        supervisorId = bc?.id ?? null;
      } else if (captain && member.id !== captain.id) {
        supervisorId = captain.id;
      }
      if (!supervisorId) continue;
      const { error } = await admin
        .from("profiles")
        .update({ supervisor_id: supervisorId })
        .eq("id", member.id);
      throwOnError("set supervisor", error);
    }
  }

  // Admin chain
  const fireChief = created.find((p) => p.rank === "Fire Chief");
  const asstChief = created.find((p) => p.rank === "Assistant Chief");
  const training = created.find((p) => p.jobTitle === "Training Officer");
  if (fireChief && asstChief) {
    await admin.from("profiles").update({ supervisor_id: fireChief.id }).eq("id", asstChief.id);
  }
  if (asstChief && training) {
    await admin.from("profiles").update({ supervisor_id: asstChief.id }).eq("id", training.id);
  }
}

async function main() {
  console.log("Seeding Demo department roster…");
  const stations = await ensureStations();
  console.log(`Stations: ${Object.keys(stations).join(", ")}`);
  const apparatus = await ensureApparatus(stations);
  console.log(`Apparatus: ${apparatus.map((u) => u.unit_number).join(", ")}`);

  const levels = await loadPermissionLevels();
  const roster = buildRoster(stations);

  const created = [];
  for (let i = 0; i < roster.length; i++) {
    const person = roster[i];
    const row = await createOrUpdatePerson(person, i, stations, levels);
    created.push({ ...row, jobTitle: person.jobTitle });
    if ((i + 1) % 10 === 0 || i === roster.length - 1) {
      console.log(`Personnel ${i + 1}/${roster.length}`);
    }
  }

  await assignSupervisors(created);

  const recruits = created.filter((p) => p.jobTitle === "Recruit — Unassigned");
  const byStation = {};
  for (const p of created) {
    const key = p.stationName ?? "(unassigned)";
    byStation[key] = (byStation[key] ?? 0) + 1;
  }

  console.log("\nDone.");
  console.log(`Total personnel: ${created.length}`);
  console.log(`Unassigned recruits: ${recruits.length}`);
  console.log("By station:", byStation);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
