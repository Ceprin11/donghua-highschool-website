
				{
					__sveltekit_ilyddq = {
						base: new URL(".", location).pathname.slice(0, -1),
						assets: "/experiments/transformer"
					};

					const element = document.currentScript.parentElement;

					Promise.all([
						import("./_app/immutable/entry/start.C8YVx8r5.js"),
						import("./_app/immutable/entry/app.CjwDoX3o.js")
					]).then(([kit, app]) => {
						kit.start(app, element);
					});
				}
			