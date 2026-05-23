use std::sync::LazyLock;

use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http::{Response as HttpResponse, StatusCode};

static EXPECTED_TOKEN: LazyLock<Option<String>> = LazyLock::new(load_expected_token);

fn load_expected_token() -> Option<String> {
    match std::env::var("OPEN_XIAOAI_TOKEN") {
        Ok(value) if !value.is_empty() => Some(value),
        Ok(_) => {
            eprintln!("⚠️  OPEN_XIAOAI_TOKEN is empty — token auth disabled");
            None
        }
        Err(_) => {
            eprintln!("⚠️  OPEN_XIAOAI_TOKEN not set — token auth disabled (dev only)");
            None
        }
    }
}

pub fn expected_token() -> Option<&'static str> {
    EXPECTED_TOKEN.as_deref()
}

pub fn token_from_query(query: &str) -> Option<&str> {
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        if parts.next()? == "token" {
            return parts.next();
        }
    }
    None
}

pub fn authorize_request_with(
    request: &Request,
    expected: Option<&str>,
) -> Result<(), ErrorResponse> {
    let Some(expected) = expected else {
        return Ok(());
    };

    let query = request.uri().query().unwrap_or("");
    let provided = token_from_query(query);

    if provided == Some(expected) {
        Ok(())
    } else {
        Err(unauthorized())
    }
}

pub fn authorize_request(request: &Request) -> Result<(), ErrorResponse> {
    authorize_request_with(request, expected_token())
}

pub fn handshake_callback(
    request: &Request,
    response: Response,
) -> Result<Response, ErrorResponse> {
    authorize_request(request)?;
    Ok(response)
}

fn unauthorized() -> ErrorResponse {
    HttpResponse::builder()
        .status(StatusCode::UNAUTHORIZED)
        .body(Some("Unauthorized".to_string()))
        .expect("valid unauthorized response")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_tungstenite::tungstenite::http::Request as HttpRequest;

    fn request_with_query(query: &str) -> Request {
        HttpRequest::builder()
            .uri(format!("http://localhost/?{}", query))
            .body(())
            .unwrap()
    }

    #[test]
    fn parses_token_from_query() {
        assert_eq!(token_from_query("token=abc"), Some("abc"));
        assert_eq!(token_from_query("foo=1&token=secret"), Some("secret"));
        assert_eq!(token_from_query("foo=1"), None);
    }

    #[test]
    fn authorize_accepts_matching_token() {
        assert!(authorize_request_with(
            &request_with_query("token=test-secret"),
            Some("test-secret")
        )
        .is_ok());
    }

    #[test]
    fn authorize_rejects_missing_or_wrong_token() {
        assert!(authorize_request_with(&request_with_query("token=wrong"), Some("test-secret")).is_err());
        assert!(authorize_request_with(&request_with_query(""), Some("test-secret")).is_err());
    }

    #[test]
    fn authorize_allows_all_when_token_unset() {
        assert!(authorize_request_with(&request_with_query(""), None).is_ok());
    }
}
