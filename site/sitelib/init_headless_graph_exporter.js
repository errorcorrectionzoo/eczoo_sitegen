import { CodeGraphSvgExporter } from '@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js';


export async function init_headless_graph_exporter()
{
    let exporter = null;
    try {

        exporter = new CodeGraphSvgExporter({
            autoCloseMs: 15 * 60 * 1000, // 15 minutes
        });

        await exporter.setup();

        return exporter;

    } catch (error) {
        console.error('Failed to initialize the SVG code graph exporter!');
        console.error(error);
        //throw new Error(`Failed to initialize the SVG code graph exporter.`);
        console.error('process.exit now');
        process.exit(101); // otherwise it looks like we end up with pending promises ...
    }
}
