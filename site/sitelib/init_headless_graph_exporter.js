import { CodeGraphSvgExporter } from '@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js';


export async function init_headless_graph_exporter(eczoodbData)
{
    let exporter = null;
    try {
        exporter = new CodeGraphSvgExporter({
            autoCloseMs: 5 * 60 * 1000, // 5 minutes
        });
        await exporter.setup();
        await exporter.loadEcZooDbData(eczoodbData);
    } catch (error) {
        console.error('Failed to initialize the SVG code graph exporter!');
        console.error(error);
        //throw new Error(`Failed to initialize the SVG code graph exporter.`);
        console.error('process.exit now');
        process.exit(101); // otherwise it looks like we end up with pending promises ...
    }
}
