use axum::{
    routing::get,
    Json, Router,
    extract::State as AxumState,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tauri::State;
use crate::db::{DbState, Clip, Snippet};

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

pub async fn start_api_server(state: DbState) {
    let app = Router::new()
        .route("/latest", get(get_latest_clip))
        .route("/snippets", get(get_all_snippets))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 14201));
    println!("API Server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_latest_clip(
    AxumState(state): AxumState<DbState>,
) -> Json<ApiResponse<Clip>> {
    let result = sqlx::query_as::<_, Clip>("SELECT * FROM clips ORDER BY created_at DESC LIMIT 1")
        .fetch_optional(&state.pool)
        .await;

    match result {
        Ok(Some(clip)) => Json(ApiResponse { success: true, data: Some(clip), error: None }),
        Ok(None) => Json(ApiResponse { success: true, data: None, error: Some("No clips found".into()) }),
        Err(e) => Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) }),
    }
}

async fn get_all_snippets(
    AxumState(state): AxumState<DbState>,
) -> Json<ApiResponse<Vec<Snippet>>> {
    let result = sqlx::query_as::<_, Snippet>("SELECT * FROM snippets ORDER BY updated_at DESC")
        .fetch_all(&state.pool)
        .await;

    match result {
        Ok(snippets) => Json(ApiResponse { success: true, data: Some(snippets), error: None }),
        Err(e) => Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) }),
    }
}
