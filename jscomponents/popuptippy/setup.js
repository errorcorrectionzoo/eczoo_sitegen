import { PopupInfoTool } from './index.js';

// fire up on load

export function load()
{

    document.querySelectorAll('.info-popup-button-zone').forEach(
        (popupZoneElement) => {

            let button_container =
                popupZoneElement.querySelector('.info-popup-button-container');

            if (button_container === null) {
                throw new Error("There was no .info-popup-button-container element "+
                                "in the .info-popup-button-zone!");
            }

            popupZoneElement.querySelectorAll('[data-is-code-info-popup]').forEach(
                (element) => {

                    let popup_button_class_list = element.dataset.popupButtonClassList;
                    if (typeof popup_button_class_list !== 'undefined') {
                        popup_button_class_list = popup_button_class_list.split(',');
                    } else {
                        popup_button_class_list = [];
                    }

                    let button_label = element.dataset.popupButtonLabel;

                    element._ecz_popup_info_tool = new PopupInfoTool({
                        popup_contents_element: element,
                        popup_button_container: button_container,
                        popup_button_label: button_label,
                        popup_button_class_list: popup_button_class_list,
                    });
                }
            );
        }
    );

    document.querySelectorAll('.redundant-if-info-popup-button-installed').forEach(
        (element) => {
            element.style.display = 'none';
        }
    );
}
