//! Merge a provider's discovered IDs into its native Responses catalog.
//! Discovery contains names, not capabilities. Only exact cache matches may
//! supply Codex metadata; never impersonate a different model.
use serde_json::{json, Value};
use std::collections::HashSet;

pub(crate) fn merge_discovered_models(
    manual: Option<Value>,
    discovered: &Value,
    cached: &Value,
    fallback: &Value,
    context_window: u64,
) -> Option<Value> {
    let mut entries = manual
        .as_ref()
        .and_then(|catalog| catalog.get("models"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut seen: HashSet<String> = entries
        .iter()
        .filter_map(|entry| entry.get("slug").and_then(Value::as_str))
        .map(str::to_owned)
        .collect();
    for id in discovered.as_array().into_iter().flatten() {
        let Some(id) = id.as_str().map(str::trim) else {
            continue;
        };
        if id.is_empty() || id.chars().any(char::is_control) || !seen.insert(id.to_owned()) {
            continue;
        }
        let known = cached
            .get("models")
            .and_then(Value::as_array)
            .and_then(|models| {
                models
                    .iter()
                    .find(|entry| entry.get("slug").and_then(Value::as_str) == Some(id))
            });
        let mut entry = fallback.clone();
        let obj = entry
            .as_object_mut()
            .expect("bundled native template is an object");
        obj.insert("display_name".into(), json!(id));
        obj.insert("description".into(), json!(id));
        obj.insert("context_window".into(), json!(context_window));
        obj.insert("max_context_window".into(), json!(context_window));
        // /models does not establish vision or reasoning support.
        obj.insert("input_modalities".into(), json!(["text"]));
        obj.insert("supported_reasoning_levels".into(), json!([]));
        obj.insert("default_reasoning_level".into(), Value::Null);
        obj.insert("supports_reasoning_summaries".into(), json!(false));
        if let Some(known) = known.and_then(Value::as_object) {
            // Keep exact model instructions, tools, reasoning levels and limits.
            // Missing required fields are supplied by the bundled template.
            obj.extend(known.clone());
        }
        obj.insert("slug".into(), json!(id));
        obj.insert("visibility".into(), json!("list"));
        obj.insert("supported_in_api".into(), json!(true));
        obj.insert("priority".into(), json!(1000 + entries.len()));
        // Account marketing and paid service tiers are not relay capabilities.
        obj.insert("additional_speed_tiers".into(), json!([]));
        obj.insert("service_tiers".into(), json!([]));
        obj.insert("availability_nux".into(), Value::Null);
        obj.insert("upgrade".into(), Value::Null);
        entries.push(entry);
    }
    if entries.is_empty() {
        manual
    } else {
        Some(json!({ "models": entries }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fallback() -> Value {
        serde_json::from_str(include_str!(
            "resources/codex_native_responses_template.json"
        ))
        .unwrap()
    }

    #[test]
    fn discovery_preserves_exact_native_capabilities_and_original_ids() {
        let cached = json!({"models": [{
            "slug": "gpt-6.1-sol", "context_window": 1000000,
            "shell_type": "unified_exec", "apply_patch_tool_type": "freeform",
            "model_messages": {"instructions_template": "model specific"},
            "supported_reasoning_levels": [{"effort": "low"}, {"effort": "high"}],
            "default_reasoning_level": "low", "input_modalities": ["text", "image"]
        }]});
        let catalog =
            merge_discovered_models(None, &json!(["gpt-6.1-sol"]), &cached, &fallback(), 128000)
                .unwrap();
        let entry = &catalog["models"][0];
        for key in [
            "slug",
            "context_window",
            "shell_type",
            "apply_patch_tool_type",
            "model_messages",
            "supported_reasoning_levels",
            "default_reasoning_level",
            "input_modalities",
        ] {
            assert_eq!(entry[key], cached["models"][0][key], "{key}");
        }
        assert!(entry.get("base_instructions").is_some());
    }

    #[test]
    fn unknown_models_are_conservative_and_do_not_inherit_a_similar_model() {
        let cached = json!({"models": [{"slug": "gpt-6.1-sol", "shell_type": "unified_exec"}]});
        let catalog = merge_discovered_models(
            None,
            &json!(["custom/gpt-6.1-sol"]),
            &cached,
            &fallback(),
            128000,
        )
        .unwrap();
        let entry = &catalog["models"][0];
        assert_eq!(entry["slug"], "custom/gpt-6.1-sol");
        assert_eq!(entry["shell_type"], "shell_command");
        assert_eq!(entry["supported_reasoning_levels"], json!([]));
        assert_eq!(entry["input_modalities"], json!(["text"]));
        assert_eq!(entry["context_window"], 128000);
    }

    #[test]
    fn manual_rows_win_and_duplicate_or_invalid_ids_are_ignored() {
        let manual = json!({"models": [{"slug": "a", "display_name": "My model"}]});
        let catalog = merge_discovered_models(
            Some(manual.clone()),
            &json!([" a ", "b", "b", "", 4, "bad\nname"]),
            &Value::Null,
            &fallback(),
            128000,
        )
        .unwrap();
        assert_eq!(catalog["models"].as_array().unwrap().len(), 2);
        assert_eq!(catalog["models"][0], manual["models"][0]);
        assert_eq!(catalog["models"][1]["slug"], "b");
    }

    #[test]
    fn provider_snapshots_do_not_leak_between_projections() {
        let project = |ids: Value| {
            merge_discovered_models(None, &ids, &Value::Null, &fallback(), 128000).unwrap()
        };
        assert_eq!(project(json!(["a"]))["models"][0]["slug"], "a");
        let b = project(json!(["b"]));
        assert_eq!(b["models"].as_array().unwrap().len(), 1);
        assert_eq!(b["models"][0]["slug"], "b");
        assert_eq!(project(json!(["a"]))["models"][0]["slug"], "a");
        assert!(
            merge_discovered_models(None, &Value::Null, &Value::Null, &fallback(), 128000)
                .is_none()
        );
    }
}
