

            let modelContainer = document.getElementById( "container" );

            let model = new TSP.models.Sequential( modelContainer, {

                animeTime: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200,
                stats: true

            } );

            model.add( new TSP.layers.GreyscaleInput() );

            model.add( new TSP.layers.Padding2d() );

            model.add( new TSP.layers.Conv2d() );

            model.add( new TSP.layers.Pooling2d() );

            model.add( new TSP.layers.Conv2d() );

            model.add( new TSP.layers.Pooling2d() );

            model.add( new TSP.layers.Dense() );

            model.add( new TSP.layers.Dense() );

            model.add( new TSP.layers.Output1d( {

                outputs: [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9" ]

            } ) );

            model.load( {

                type: "tfjs",
                url: './lenetModel/mnist.json'

            } );

            model.init(() => { document.getElementById('prediction').textContent = '请写下一个数字'; });
 document.getElementById('reset-view').onclick = () => model.modelRenderer.reset();
 window.addEventListener('pagehide', () => disposeTensorSpace(model));

        