const AREA_SIZE: usize = 16;
const MAX_RADIUS: i32 = 1_048_576;
const WORLD_BORDER_CHUNK_MIN: i32 = -1_875_000;
const WORLD_BORDER_CHUNK_MAX: i32 = 1_874_999;
const MASK_48: u64 = (1 << 48) - 1;
const JAVA_RANDOM_MULTIPLIER: u64 = 0x5deece66d;
const JAVA_RANDOM_XOR: u64 = 0x5e434e432;
const RESULT_HEADER_LEN: usize = 8;
const RESULT_LEN: usize = RESULT_HEADER_LEN + AREA_SIZE * AREA_SIZE;

#[link(wasm_import_module = "env")]
unsafe extern "C" {
    fn report_progress(completed_rows: i32, total_rows: i32);
}

fn x_seed_term(chunk_x: i32) -> i64 {
    let square_term = chunk_x.wrapping_mul(chunk_x).wrapping_mul(4_987_142) as i64;
    let linear_term = chunk_x.wrapping_mul(5_947_611) as i64;
    square_term + linear_term
}

fn z_seed_term(chunk_z: i32) -> u64 {
    let squared = chunk_z.wrapping_mul(chunk_z) as i64 as i128;
    let linear = chunk_z.wrapping_mul(389_711) as i64 as i128;
    ((squared * 4_392_871 + linear) as u128 as u64) & MASK_48
}

fn next_java_random_seed(seed: u64) -> u64 {
    seed.wrapping_mul(JAVA_RANDOM_MULTIPLIER).wrapping_add(11) & MASK_48
}

fn slime_from_terms(seed: u64, x_term: i64, z_term: u64) -> bool {
    let sum = (seed as i128 + x_term as i128 + z_term as i128) as u128 as u64 & MASK_48;
    let mut random_seed = (sum ^ JAVA_RANDOM_XOR) & MASK_48;
    loop {
        random_seed = next_java_random_seed(random_seed);
        let bits = random_seed >> 17;
        let value = bits % 10;
        if bits - value + 9 <= 0x7fff_ffff {
            return value == 0;
        }
    }
}

fn is_slime_chunk(seed: u64, chunk_x: i32, chunk_z: i32) -> bool {
    slime_from_terms(seed, x_seed_term(chunk_x), z_seed_term(chunk_z))
}

#[no_mangle]
pub extern "C" fn search(
    seed: u64,
    center_chunk_x: i32,
    center_chunk_z: i32,
    radius: i32,
    window_start_x: i32,
    window_count_x: i32,
) -> i32 {
    if !(0..=MAX_RADIUS).contains(&radius) || window_start_x < 0 || window_count_x <= 0 {
        return 0;
    }

    let starts_per_axis = radius * 2 + 1;
    if window_start_x + window_count_x > starts_per_axis {
        return 0;
    }

    let full_start_chunk_x = center_chunk_x - 7 - radius;
    let start_chunk_x = full_start_chunk_x + window_start_x;
    let start_chunk_z = center_chunk_z - 7 - radius;
    let scanned_side = starts_per_axis + AREA_SIZE as i32 - 1;
    let scanned_width = window_count_x + AREA_SIZE as i32 - 1;
    if start_chunk_x < WORLD_BORDER_CHUNK_MIN
        || start_chunk_z < WORLD_BORDER_CHUNK_MIN
        || full_start_chunk_x < WORLD_BORDER_CHUNK_MIN
        || full_start_chunk_x + starts_per_axis - 1 + AREA_SIZE as i32 - 1 > WORLD_BORDER_CHUNK_MAX
        || start_chunk_z + starts_per_axis - 1 + AREA_SIZE as i32 - 1 > WORLD_BORDER_CHUNK_MAX
    {
        return 0;
    }

    let starts = window_count_x as usize;
    let scanned = scanned_width as usize;
    let scanned_rows = scanned_side as usize;
    let mut x_terms = Vec::with_capacity(scanned);
    for x in 0..scanned {
        x_terms.push(x_seed_term(start_chunk_x + x as i32));
    }

    let mut vertical_sums = vec![0_i32; starts];
    let mut previous_rows = vec![vec![0_u8; starts]; AREA_SIZE];
    let mut row_chunks = vec![0_u8; scanned];
    let mut row_sums = vec![0_u8; starts];
    let mut best_count = -1_i32;
    let mut tied_windows = 0_u64;
    let mut best_distance = i64::MAX;
    let mut best_x = start_chunk_x;
    let mut best_z = start_chunk_z;
    let progress_step = (scanned_rows / 1_000).max(1);

    for z in 0..scanned_rows {
        let z_term = z_seed_term(start_chunk_z + z as i32);
        for x in 0..scanned {
            row_chunks[x] = slime_from_terms(seed, x_terms[x], z_term) as u8;
        }

        let mut horizontal_sum = 0_i32;
        for chunk in row_chunks.iter().take(AREA_SIZE) {
            horizontal_sum += *chunk as i32;
        }
        for x in 0..starts {
            row_sums[x] = horizontal_sum as u8;
            if x + AREA_SIZE < scanned {
                horizontal_sum += row_chunks[x + AREA_SIZE] as i32 - row_chunks[x] as i32;
            }
        }

        let history_index = z % AREA_SIZE;
        let previous_row = &mut previous_rows[history_index];
        for x in 0..starts {
            if z >= AREA_SIZE {
                vertical_sums[x] -= previous_row[x] as i32;
            }
            vertical_sums[x] += row_sums[x] as i32;
            previous_row[x] = row_sums[x];
        }

        if z < AREA_SIZE - 1 {
            continue;
        }
        let window_z = start_chunk_z + z as i32 - (AREA_SIZE as i32 - 1);
        for x in 0..starts {
            let count = vertical_sums[x];
            let window_x = start_chunk_x + x as i32;
            let dx = window_x as i64 * 2 + AREA_SIZE as i64 - 1 - center_chunk_x as i64 * 2 - 1;
            let dz = window_z as i64 * 2 + AREA_SIZE as i64 - 1 - center_chunk_z as i64 * 2 - 1;
            let distance = dx * dx + dz * dz;
            if count > best_count {
                best_count = count;
                tied_windows = 1;
                best_distance = distance;
                best_x = window_x;
                best_z = window_z;
            } else if count == best_count {
                tied_windows += 1;
                if distance < best_distance {
                    best_distance = distance;
                    best_x = window_x;
                    best_z = window_z;
                }
            }
        }

        if z % progress_step == 0 || z + 1 == scanned_rows {
            unsafe { report_progress((z + 1) as i32, scanned_side) };
        }
    }

    let mut output = vec![0_i32; RESULT_LEN].into_boxed_slice();
    output[0] = best_x;
    output[1] = best_z;
    output[2] = best_count;
    output[3] = tied_windows as u32 as i32;
    output[4] = (tied_windows >> 32) as u32 as i32;
    let tested_windows = (window_count_x as u64) * (starts_per_axis as u64);
    output[5] = tested_windows as u32 as i32;
    output[6] = (tested_windows >> 32) as u32 as i32;
    output[7] = radius;
    for z in 0..AREA_SIZE {
        for x in 0..AREA_SIZE {
            output[RESULT_HEADER_LEN + z * AREA_SIZE + x] = is_slime_chunk(seed, best_x + x as i32, best_z + z as i32) as i32;
        }
    }

    Box::into_raw(output) as *mut i32 as usize as i32
}
