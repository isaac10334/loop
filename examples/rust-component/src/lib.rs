wit_bindgen::generate!({ path: "../../wit/probe", world: "probe", generate_all });

struct Probe;
impl Guest for Probe {
    async fn consume() -> u32 {
        let _random = wasi::random::random::get_random_u64();
        let (future, mut stream) = feed();
        let mut sum = future.await;
        while let Some(value) = stream.next().await { sum += value; }
        sum
    }
    async fn run() -> u32 { wait_event().await + 1 }
    async fn wasi_clock() -> u64 {
        let start = wasip3::clocks::monotonic_clock::now();
        wasip3::clocks::monotonic_clock::wait_for(25_000_000).await;
        wasip3::clocks::monotonic_clock::now() - start
    }
}
export!(Probe);
