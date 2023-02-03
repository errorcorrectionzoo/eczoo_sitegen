import React from 'react';

// use yaml library for exporting cause I figured out how to tweak the options
// in the way we like them.  But its parser seems to fail on some of our codes,
// e.g., it doesn't seem it can parse multi-line strings.
import YAML from 'yaml';

import jsyaml from 'js-yaml';


import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
//import remarkToc from 'remark-toc';
import rehypeRaw from 'rehype-raw';


import EczEditSchemaField from './EczEditSchemaField.jsx';

import './EczEditCodeApp_style.scss';

import welcome_md from 'bundle-text:./welcome.md';
import latexlike_md from 'bundle-text:./latexlike.md';




class EczSidebarDocPage extends React.Component {
    shouldComponentUpdate(newProps, newState) {
        return false;
    }
    render() {
        return (<div className={"help_text " + this.props.pageClassName}>
            <ReactMarkdown
                components={{
                    a: ({node, ...props}) => {
                        let apr = {};
                        if (props.href) {
                            apr.href = props.href;
                            if (!props.href.startsWith("#")) {
                                apr.target = "_blank";
                            }
                        }
                        if (props.title) {
                            apr.title = props.title;
                        }
                        return ( <a {... apr}>{props.children}</a> );
                    }
                }}
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
            >
                {this.props.children}
            </ReactMarkdown>
        </div>);
    }
}

class EczEditCodeAppSidebar extends React.Component
{
    constructor(props) {
        super(props);
        this.state = {
            collapsed: false,
        };
    }
    render() {
        let cls = 'EczEditCodeAppSidebar';
        if (this.state.collapsed) {
            cls += ' collapsed';
        } else {
            cls += ' not-collapsed';
        }
        return (
            <div className={cls}>
                <button key='btn'
                        onClick={()=>this.setState({collapsed: !this.state.collapsed})}
                >&lt; - &gt;</button>
                <div key='div'
                     className="sidebar-contents">
                    <Tabs>
                        <TabList>
                            <Tab key={'tb-welcome'}>Welcome!</Tab>
                            <Tab key={'tb-latexlike'}>LaTeX-like</Tab>
                            <Tab key={'tb-lookup_page'}>Lookup</Tab>
                        </TabList>

                        <TabPanel key={"welcome"}>
                            <EczSidebarDocPage pageClassName="tab_page welcome">
                                {welcome_md}
                            </EczSidebarDocPage>
                        </TabPanel>
                        <TabPanel key={"latexlike"}>
                            <EczSidebarDocPage pageClassName="tab_page latex-like">
                                {latexlike_md}
                            </EczSidebarDocPage>
                        </TabPanel>
                        <TabPanel key={"lookup_page"}>
                            <div className="tab_page lookup_page">
                                Soon we'll try to provide a simple UI to look up code_id's
                                etc.
                            </div>
                        </TabPanel>
                    </Tabs>
                </div>
            </div>
        );
    }
};



class EczBottomBar extends React.Component {
    shouldComponentUpdate(newProps, newState) {
        return false;
    }
    render() {
        const mailtolink = "mailto:errorcorrectionzoo@XXXXXX?subject=code data&body=Please attach the downloaded file and send this email, replacing '@XXXXXX' in the email address by '@gmail.com'. Thanks for your contribution! You can add additional notes to our attention below:";

                // <button key={'validate'}
                //         onClick={
                //             this.props.onClickValidate
                //         }>Prelim. Check</button>
        return (
            <div key={'bottombar'} className="EczEditCodeApp_bottombar">
                <div key={'spc'} className="spacer" />
                <button key={'clear'}
                        onClick={
                            this.props.onClickClear
                        }>Clear all fields</button>
                <button key={'load'}
                        onClick={
                            this.props.onClickLoadYaml
                        }>Load YAML file ...</button>
                <button key={'submit'}
                        onClick={
                            this.props.onClickSubmit
                        }>Download data file ...</button>
                <span key={'email-text'}>
                    Please attach the downloaded file to <a href={mailtolink}>
                    an e-mail to this address</a>.
                </span>
                <a key={'dnlwd-a-elem'} id="a-download-element"
                   className="no-display"/>
                <input key={'input-file-elem'}
                       type="file"
                       id="input-file-element"
                       className="no-display"
                       onChange={
                           (event) => {
                               if (event.target.files && event.target.files[0]) {
                                   this.props.onUploadFileSelected(event.target.files[0]);
                               }
                           }
                       }/>
            </div>
        );
    }

};





export default class EczEditCodeApp extends React.Component
{
    constructor(props) {
        super(props);
        this.state = {
            code_yml_basename: this.props.code_yml_basename,
            code_data: props.code_data
        }
    }

    render()
    {
        return [
            <div key={'mainpane'} className="EczEditCodeApp_main_pane">
                <EczEditSchemaField
                    fieldname={''}
                    schema={this.props.code_schema}
                    value={this.state.code_data}
                    onChange={(new_code_data) => this.set_new_code_data(new_code_data)}
                />
            </div>,
            <EczEditCodeAppSidebar key={'sidebar'}  />,
            <EczBottomBar
                key={'bottombar'}
                onClickClear={() => this.do_clear()}
                onClickLoadYaml={() => this.do_load_yaml()}
                onUploadFileSelected={(file) => this.do_upload_file_selected(file)}
                onClickSubmit={() => this.do_submit()}
            />
        ];
        //                 onClickValidate={() => this.do_validate()}
    }

    set_new_code_data(new_code_data) {
        console.log("Code data changed = ", new_code_data);
        this.setState({ code_data: new_code_data });
    }


    _confirm_clear() {
        console.log("Confirm discarding data? ", this.state.code_data);
        if ( this.state.code_data && Object.keys(this.state.code_data).length ) {
            if (!window.confirm("Current data fields will be lost. Continue?")) {
                return false;
            }
        }
        return true;
    }

    do_clear() {
        if (!this._confirm_clear()) { return; }

        this.setState({
            code_yml_basename: '',
            code_data: {},
        });
    }

    do_load_yaml() {
        if (!this._confirm_clear()) { return; }

        let input_element = document.getElementById('input-file-element');
        input_element.click();
    }

    async do_upload_file_selected(file) {
        const yaml_text = await file.text();

        console.log("Got YAML data: ", yaml_text);

        let code_data = {};
        try {
            code_data = jsyaml.load( yaml_text );
            console.log("parsed YAML data to object: ", code_data);
        } catch (exc) {
            alert("Error parsing YAML file!\n\n" + exc);
            return;
        }

        const code_yml_basename = file.name;

        this.setState({
            code_yml_basename: code_yml_basename,
            code_data: code_data,
        })
    }


    // do_validate() {
    //     // do a simple validation of the entries against the schema
    //     .....
    // }


    do_submit() {
        console.log("Preparing data file for download ...");

        const yaml_data = generate_yaml(this.state.code_data);

        let code_yml_basename = this.state.code_yml_basename;
        if ( ! code_yml_basename) {
            code_yml_basename = "code_"+yaml_data.code_id+".yml";
        }

        // Get the value from the editor
        console.log(yaml_data);
        var data = new Blob([yaml_data]);
        var a = document.getElementById('a-download-element');
        a.setAttribute("download", code_yml_basename);
        a.href = URL.createObjectURL(data);
        a.click();
    }

};




function generate_yaml(code_data)
{
    const yamldoc = new YAML.Document( code_data );

    yamldoc.commentBefore =
        '######################################################\n'
        +'# This is a code entry in the error correction zoo. ##\n'
        +'#       https://github.com/errorcorrectionzoo       ##\n'
        +'######################################################\n';

    YAML.visit(
        yamldoc,
        {
            Pair(_, pair, path) {
                console.log('pair =', pair, '; path =', path);
                if (path.length <= 6) { // [document, map object] for root map
                    pair.key.spaceBefore = true;
                } else {
                    pair.key.spaceBefore = false;
                }
            },
            Seq(key, node, path) {
                console.log('seq; node =', node, '; path =', path);
                node.items.forEach( (child, index) => {
                    if (index > 0) {
                        child.spaceBefore = true;
                    }
                } );
            },
            Map(key, node, path) {
                console.log('map; node =', node, '; path =', path);
                node.items.forEach( (child, index) => {
                    if (index > 0) {
                        child.spaceBefore = true;
                    }
                } );
            },
            Scalar(key, node) {
                console.log('string; key =', key, ' node =', node);
                if (key == 'key') {
                    node.type = 'PLAIN';
                } else if (typeof node.value === 'string') {
                    let value = node.value;
                    if (value.indexOf('\n') == -1) {
                        node.type = 'QUOTE_SINGLE';
                    } else {
                        node.type = 'BLOCK_LITERAL';
                    }
                }
            },
        }
    );

    const yamlcode = yamldoc.toString({
        lineWidth: 0, // inhibit folding of single-quoted strings for Victor
    });

    return yamlcode;
}
