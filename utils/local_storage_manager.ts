// helpers.js
export default class LocalStorage {

    static setData(value: string) {
        return localStorage.setItem('session', value);
    }

    static getSession() {
        return localStorage.getItem('session');
    }

    /*function checkValidity(): boolean {

        if(getSession() == false) return false;
        return true;
    }*/
}