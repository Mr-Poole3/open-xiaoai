use neon::prelude::*;
use node::NodeManager;
use open_xiaoai::services::audio::config::AudioConfig;
use open_xiaoai::services::connect::{message::MessageManager, rpc::RPC};

use runtime::runtime;
use serde_json::json;
use server::AppServer;

mod connection_auth;
mod node;
mod runtime;
mod server;

#[neon::export]
async fn start() -> () {
    let _ = AppServer::run().await;
}

#[neon::export]
async fn run_shell(script: String, timeout_millis: f64) -> String {
    let res = RPC::instance()
        .call_remote(
            "run_shell",
            Some(json!(script)),
            Some(timeout_millis as u64),
        )
        .await;
    match res {
        Err(e) => format!("run_shell error: {}", e),
        Ok(res) => serde_json::to_string(&res.data.unwrap()).unwrap(),
    }
}

#[neon::export]
async fn on_output_data(bytes: Vec<u8>) -> bool {
    MessageManager::instance()
        .send_stream("play", bytes, None)
        .await
        .is_ok()
}

#[neon::export]
async fn start_play(config_json: String) -> bool {
    let payload = if config_json.is_empty() {
        None
    } else {
        serde_json::from_str::<AudioConfig>(&config_json)
            .ok()
            .map(|config| json!(config))
    };
    match RPC::instance()
        .call_remote("start_play", payload, Some(10_000))
        .await
    {
        Ok(response) => response.code.unwrap_or(-1) == 0,
        Err(_) => false,
    }
}

#[neon::export]
async fn stop_play() -> bool {
    match RPC::instance()
        .call_remote("stop_play", None, Some(10_000))
        .await
    {
        Ok(response) => response.code.unwrap_or(-1) == 0,
        Err(_) => false,
    }
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    let _ = neon::set_global_executor(&mut cx, runtime());
    neon::registered().export(&mut cx)?;
    NodeManager::instance().init(cx);
    Ok(())
}
