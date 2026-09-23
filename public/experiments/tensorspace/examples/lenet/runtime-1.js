

            let signaturePad = new SignaturePad( document.getElementById( 'signature-pad' ), {

                minWidth: 10,
                backgroundColor: 'rgba(255, 255, 255, 0)',
                penColor: 'rgb(103, 151, 174)',
                onEnd: getImage

            } );

            function getImage() {
 if (!model.isInitialized) return;

                let canvas = document.getElementById( "signature-pad" );
                let context = canvas.getContext( '2d' );
                let imgData = context.getImageData( 0, 0, canvas.width, canvas.height );

                let signatureData = [];

                for ( let i = 0; i < 224; i += 8 ) {

                    for ( let j = 3; j < 896; j += 32 ) {

                        signatureData.push( imgData.data[ 896 * i + j ] / 255 );

                    }

                }

                model.predict(signatureData, scores => { const values = Array.from(scores); const best = values.indexOf(Math.max(...values)); document.getElementById('prediction').textContent = '预测 ' + best + ' · ' + (values[best]*100).toFixed(1) + '%'; });

            }

            $( function() {

                $( "#clear" ).click( function() {

                    signaturePad.clear();
                    model.clear(); document.getElementById('prediction').textContent = '请写下一个数字';

                } );

            } );

        