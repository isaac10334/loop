use super::*;

#[test]
fn legacy_run_defaults_remain_unchanged() {
    let cli = Cli::try_parse_from(["loop", "run"]).unwrap();
    match cli.command {
        Command::Run {
            path,
            headless,
            actions,
            writable,
            kit,
        } => {
            assert_eq!(path, PathBuf::from("."));
            assert!(!headless);
            assert!(!writable);
            assert_eq!(actions, vec!["refresh"]);
            assert!(kit.config.is_none());
        }
        _ => panic!("wrong command"),
    }
}
#[test]
fn both_official_create_kits_parse_without_changing_legacy_create() {
    for kind in ["browser", "native"] {
        let cli = Cli::try_parse_from(["loop", "create", "demo", "--kit", kind, "--yes"]).unwrap();
        match cli.command {
            Command::Create(options) => {
                assert_eq!(options.kit.as_deref(), Some(kind));
                assert!(options.legacy.yes);
            }
            _ => panic!("wrong command"),
        }
    }
    let cli = Cli::try_parse_from(["loop", "create", "demo", "--yes"]).unwrap();
    assert!(matches!(
        cli.command,
        Command::Create(CreateOptions { kit: None, .. })
    ));
    assert!(Cli::try_parse_from(["loop", "create", "demo", "--kit", "electrobun"]).is_err());
}
#[test]
fn kit_verbs_and_explicit_selectors_parse() {
    for operation in ["dev", "run", "build"] {
        let cli = Cli::try_parse_from([
            "loop",
            operation,
            "project",
            "--config",
            "loop.config.ts",
            "--target",
            "web",
            "--trust-local-config",
            "--json",
        ])
        .unwrap();
        let kit = match cli.command {
            Command::Dev { kit, .. } | Command::Run { kit, .. } | Command::Build { kit, .. } => kit,
            _ => panic!("wrong command"),
        };
        assert_eq!(kit.config, Some(PathBuf::from("loop.config.ts")));
        assert_eq!(kit.target.as_deref(), Some("web"));
        assert!(kit.trust_local_config);
        assert!(kit.json);
    }
    assert!(Cli::try_parse_from(["loop", "start"]).is_err());
}
#[test]
fn stopping_or_restarting_requires_explicit_instance_and_root() {
    for operation in ["stop", "restart"] {
        assert!(Cli::try_parse_from(["loop", operation, "a"]).is_err());
        assert!(Cli::try_parse_from(["loop", operation, "--root", "project"]).is_err());
        assert!(
            Cli::try_parse_from(["loop", operation, "a", "--root", "project", "--json"]).is_ok()
        );
    }
}
#[test]
fn static_and_evaluating_inspection_are_distinct() {
    let cli = Cli::try_parse_from(["loop", "inspect", "project", "--json"]).unwrap();
    assert!(matches!(
        cli.command,
        Command::Inspect {
            evaluate_config: false,
            ..
        }
    ));
    let cli = Cli::try_parse_from([
        "loop",
        "inspect",
        "project",
        "--evaluate-config",
        "--trust-local-config",
    ])
    .unwrap();
    assert!(matches!(
        cli.command,
        Command::Inspect {
            evaluate_config: true,
            ..
        }
    ));
    assert!(
        Cli::try_parse_from([
            "loop",
            "inspect",
            "project",
            "--plan",
            "receipt.json",
            "--evaluate-config"
        ])
        .is_err()
    );
}
#[test]
fn legacy_mode_does_not_silently_ignore_new_selectors() {
    assert!(
        reject_unselected_kit_flags(&KitSelectors {
            target: Some("web".into()),
            ..Default::default()
        })
        .is_err()
    );
    assert!(
        reject_unselected_kit_flags(&KitSelectors {
            profile: Some("review".into()),
            ..Default::default()
        })
        .is_err()
    );
    assert!(reject_unselected_kit_flags(&KitSelectors::default()).is_ok());
}
#[test]
fn skill_manager_passes_management_flags_without_a_second_parser() {
    let cli = Cli::try_parse_from([
        "loop",
        "skills",
        "install",
        "loop-host-kits",
        "--scope",
        "project",
        "--root",
        "fixture",
        "--adapter",
        "codex-v1",
        "--dry-run",
        "--json",
    ])
    .unwrap();
    match cli.command {
        Command::Skills { args } => {
            assert_eq!(args[0], "install");
            assert!(args.contains(&"--dry-run".into()));
            assert!(args.contains(&"--json".into()));
        }
        _ => panic!("wrong command"),
    }
}
