// Modul murni: tidak menyentuh document/window. Semua mutasi terjadi pada
// objek state yang diberikan sebagai argumen.

// --- pemilihan dari roster -------------------------------------------------

/** Member yang tergabung di minimal satu grup terpilih. */
export function eligibleMembers(members, selected) {
  return members.filter((m) => m.groups.some((g) => selected.has(g)));
}

/** Salinan terurut. `debut` yang hilang/kosong diperlakukan sebagai string kosong. */
export function sortGroups(groups, debutDesc) {
  const dir = debutDesc ? -1 : 1;
  return [...groups].sort((a, b) => {
    const da = String(a.debut ?? '');
    const db = String(b.debut ?? '');
    return dir * (da.localeCompare(db) || String(a.id).localeCompare(String(b.id)));
  });
}

// --- aritmetika turnamen ---------------------------------------------------

/** Berapa ronde heat yang dibutuhkan sebelum sisa kandidat <= 20. */
export function roundCount(n) {
  let count = 0;
  while (n > 20) {
    count++;
    n = 3 * Math.floor(n / 9) + Math.min(3, n % 9);
  }
  return count;
}

/** Batas atas perbandingan merge-sort untuk n elemen. */
export function sortLimit(n) {
  if (n <= 1) return 0;
  const left = Math.floor(n / 2);
  return sortLimit(left) + sortLimit(n - left) + n - 1;
}

/** Bagi rata ke dalam ember per grup lalu ambil bergiliran, supaya member satu grup tidak beradu di layar yang sama. */
export function initialOrder(ids, firstGroupOf) {
  const buckets = new Map();
  for (const id of ids) {
    const key = firstGroupOf(id);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(id);
  }
  const out = [];
  while (out.length < ids.length) {
    for (const bucket of buckets.values()) if (bucket.length) out.push(bucket.shift());
  }
  return out;
}

/** Ambil kolom 0..2 dari tiap ronde, bergantian. */
export function interleave(rounds) {
  const out = [];
  for (let col = 0; col < 3; col++) {
    for (const round of rounds) if (round[col]) out.push(round[col]);
  }
  return out;
}

/** Layar final dibagi rata ke 9 slot, layar lain menampung 9 orang. */
export function heatSize(poolLength, stage) {
  return stage === 'final'
    ? Math.ceil(poolLength / Math.ceil(poolLength / 9))
    : 9;
}

// --- state machine heat ----------------------------------------------------

export function createHeat() {
  return {
    stage: 'main', // 'main' | 'challenge' | 'final'
    round: 1,
    roundTotal: 1,
    pool: [],
    winners: [],
    losers: [],
    index: 0,
    current: [],
    selected: new Set(),
    mainSurvivors: [],
  };
}

/** Muat layar berikutnya ke `hs.current` dan kosongkan pilihan. */
export function beginHeat(hs) {
  const size = heatSize(hs.pool.length, hs.stage);
  hs.current = hs.pool.slice(hs.index, hs.index + size);
  hs.index += hs.current.length;
  hs.selected = new Set();
}

/**
 * Catat hasil satu layar. Mengembalikan 'continue' bila masih ada layar lain
 * di pool yang sama, 'advance' bila pool ini sudah habis.
 * Pemanggil yang memuat layar berikutnya (lihat confirmHeat), bukan fungsi ini.
 */
export function finishHeat(hs, pickedIds) {
  const need = Math.min(3, hs.current.length);
  if (pickedIds.length !== need) return { ok: false, need };

  const picked = new Set(pickedIds);
  hs.winners.push(hs.current.filter((id) => picked.has(id)));
  if (hs.stage === 'main') {
    hs.losers.push(...hs.current.filter((id) => !picked.has(id)));
  }

  if (hs.index < hs.pool.length) return { ok: true, action: 'continue' };
  return { ok: true, action: 'advance' };
}

/** Tentukan fase berikutnya setelah satu pool selesai. */
export function advanceHeat(hs) {
  if (hs.stage === 'final') {
    return { next: 'sort', ids: interleave(hs.winners) };
  }

  if (hs.stage === 'challenge') {
    const challenged = interleave(hs.winners);
    const candidates = [];
    for (let i = 0; i < Math.max(hs.mainSurvivors.length, challenged.length); i++) {
      if (hs.mainSurvivors[i]) candidates.push(hs.mainSurvivors[i]);
      if (challenged[i]) candidates.push(challenged[i]);
    }
    if (candidates.length >= 19) {
      hs.stage = 'final';
      hs.pool = candidates;
      hs.winners = [];
      hs.index = 0;
      beginHeat(hs);
      return { next: 'heat' };
    }
    return { next: 'sort', ids: candidates };
  }

  const winners = interleave(hs.winners);
  if (winners.length <= 20) {
    hs.mainSurvivors = winners;
    if (hs.losers.length) {
      hs.stage = 'challenge';
      hs.pool = [...hs.losers];
      hs.winners = [];
      hs.index = 0;
      beginHeat(hs);
      return { next: 'heat' };
    }
    return { next: 'sort', ids: winners };
  }

  hs.round++;
  hs.pool = winners;
  hs.winners = [];
  hs.losers = [];
  hs.index = 0;
  beginHeat(hs);
  return { next: 'heat' };
}

// --- state machine merge sort ----------------------------------------------

export function createSort() {
  return {
    stack: [],
    left: null,
    right: null,
    comparisons: 0,
    candidateCount: 0,
    done: false,
    result: [],
  };
}

function finishSort(st, result) {
  st.done = true;
  st.result = result;
  st.left = null;
  st.right = null;
  return { done: true, result };
}

export function beginSort(st, ids) {
  if (ids.length < 9) return { ok: false, reason: 'too-few', count: ids.length };
  st.candidateCount = ids.length;
  st.stack = [{ ids: [...ids], stage: 0 }];
  st.left = null;
  st.right = null;
  st.comparisons = 0;
  st.done = false;
  st.result = [];
  return beginMerge(st);
}

/**
 * Jalankan stack sampai butuh keputusan manusia, lalu berhenti dengan
 * `st.left` dan `st.right` berisi dua kandidat yang harus dibandingkan.
 */
export function beginMerge(st) {
  while (st.stack.length) {
    const frame = st.stack.at(-1);

    if (frame.ids.length === 1) {
      st.stack.pop();
      if (!st.stack.length) return finishSort(st, frame.ids.slice(0, 9));
      const parent = st.stack.at(-1);
      if (parent.stage === 1) parent.left = frame.ids;
      else parent.right = frame.ids;
      continue;
    }

    if (frame.stage === 0) {
      frame.stage = 1;
      st.stack.push({ ids: frame.ids.slice(0, Math.floor(frame.ids.length / 2)), stage: 0 });
      continue;
    }

    if (frame.stage === 1 && frame.left) {
      frame.stage = 2;
      st.stack.push({ ids: frame.ids.slice(Math.floor(frame.ids.length / 2)), stage: 0 });
      continue;
    }

    if (frame.stage === 2 && frame.right) {
      frame.stage = 3;
      frame.out = [];
      frame.l = 0;
      frame.r = 0;
    }

    if (frame.stage === 3) {
      if (frame.l === frame.left.length || frame.r === frame.right.length) {
        frame.out.push(...frame.left.slice(frame.l), ...frame.right.slice(frame.r));
        st.stack.pop();
        if (!st.stack.length) return finishSort(st, frame.out.slice(0, 9));
        const parent = st.stack.at(-1);
        if (parent.stage === 1) parent.left = frame.out;
        else parent.right = frame.out;
        continue;
      }
      st.left = frame.left[frame.l];
      st.right = frame.right[frame.r];
      return { done: false };
    }

    return { done: false };
  }
  return finishSort(st, st.result);
}

/**
 * Catat pilihan pengguna untuk satu perbandingan, lalu lanjutkan merge.
 * Pilihan HARUS masuk ke `frame.out`: pada akhir merge hanya sisa antrean yang
 * ditambahkan, jadi tanpa baris itu semua pilihan sebelumnya hilang.
 */
export function chooseSort(st, id) {
  const frame = st.stack.at(-1);
  if (!frame || frame.stage !== 3) return { done: false, ignored: true };

  if (id === st.left) {
    frame.out.push(id);
    frame.l++;
  } else if (id === st.right) {
    frame.out.push(id);
    frame.r++;
  } else {
    return { done: false, ignored: true };
  }

  st.comparisons++;
  return beginMerge(st);
}
