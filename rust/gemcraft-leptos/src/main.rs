mod data;
mod db;
mod extract;
mod gem;
mod llm;
mod micro_app;
mod toggle;

use html::Data;
use leptos::*;
use logging::log;
use std::collections::HashMap;
use uuid::Uuid;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

use data::{ClassificationData, DataGem};
use gem::{DataGemEditor, MiniDataGemPreview};
use micro_app::{parse_micro_app_ideas, MicroAppGrid};

fn main() {
    console_error_panic_hook::set_once();

    // let saved = db::list::<DataGem>("").unwrap();
    // for (id, gem) in saved {
    //     log!("Loaded saved gem {}: {:?}", id, gem);
    // }

    mount_to_body(|| view! { <App /> })
}

#[component]
fn App() -> impl IntoView {
    let gems = create_rw_signal(db::list::<DataGem>("").unwrap());
    let search = create_rw_signal(String::new());
    let (selection, set_selection) = create_signal(Vec::<String>::new());
    let (imagined_apps, set_imagined_apps) = create_signal(String::new());

    let insert = |id: String, gem: DataGem, gems: &mut HashMap<String, DataGem>| {
        gems.insert(id.clone(), gem.clone());
        db::save("", &id, &gem);
    };

    let on_toggle_selection = move |id| {
        set_selection.update(|current| {
            if current.contains(&id) {
                current.retain(|x| x != &id);
            } else {
                current.push(id.clone());
            }
        })
    };

    let on_classify = move |(id, classification, description, json_data)| {
        gems.update(|gems| {
            insert(
                id,
                DataGem {
                    classification: Some(classification),
                    description,
                    json_data,
                },
                gems,
            )
        });
    };

    let combine_data = create_action(move |_| {
        async move {
            // use only selected gems
            let selectedData = gems
                .get()
                .iter()
                .filter(|(id, _)| selection.get().contains(id))
                .map(|(_, gem)| gem.clone())
                .collect();
            let data = llm::combine_data(selectedData, search.get()).await;
            match data {
                Ok(data) => {
                    log!("Response: {:?}", data);
                    set_imagined_apps.set(data.output);
                }
                Err(e) => {
                    log!("Error: {:?}", e);
                }
            }
        }
    });

    let on_save = move |_| {
        let data = imagined_apps.get();
        let ideas = parse_micro_app_ideas(data.as_str());

        // add each idea as a gem
        gems.update(|gems| {
            for idea in ideas {
                let id = Uuid::new_v4().to_string();
                insert(
                    id.clone(),
                    DataGem {
                        classification: None,
                        description: idea.spec.clone(),
                        json_data: idea.view_model.clone(),
                    },
                    gems,
                );
            }
        });
    };

    view! {
        <div class="app"><div>
        <div>
        <button on:click=move |_| gems.update(|gems| gems.clear())>"Clear"</button>
        <button on:click=move |_| gems.update(|gems|  {
            let id = Uuid::new_v4().to_string();
            gems.insert(
                id,
                DataGem {
                    classification: Some(ClassificationData {
                        title: "Test".to_string(),
                        content_type: "Test".to_string(),
                        emoji: "❓".to_string(),
                        sensitivity: "Test".to_string(),
                    }),
                    description: "Test".to_string(),
                    json_data: "{}".to_string(),
                });
        })>
            "Add Gem"
        </button>
        </div>
        <div class="gem-dock">

        {move || gems()
            .into_iter()
            .map(|(id, gem)| view! { <DataGemEditor id=id.to_string() gem=gem selected=selection.get().contains(&id) on_classify=on_classify on_toggle=on_toggle_selection /> })
            .collect_view()}
        </div>
        </div>
            <div>
                <div class="gem-list">
                    {move || selection.get().iter().map(|id| view! { <MiniDataGemPreview gem=gems.get().get(id).unwrap().clone() /> }).collect_view()}
                </div>
                <input type="text" placeholder="Search" on:input=move |e| search.set(event_target_value(&e)) prop:value=search></input>
                <button on:click=move |_| combine_data.dispatch(gems)>"Imagine"</button>
                <MicroAppGrid input={imagined_apps} on_save=on_save></MicroAppGrid>
            </div>
        </div>
    }
}
