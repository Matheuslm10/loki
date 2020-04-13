import LacunaWebPki from 'web-pki'
import { actionTypes } from '../store'

/**
 * @module AzDigitalSignature
 * @description The methods must be called in the following order: constructor, loadWebPki,
 * listCertificates, sign.
 *
 * @method constructor requires a Vuex Store instance
 * @method loadWebPki return true if web-pki is installed. If returned false call redirectToInstallWebPki
 * @method listCertificates return list of available certificates in web-pki chrome
 * @method sign sign the document
 */
export default class AzDigitalSignature {
    /**
     * Create a new instance of AzDigitalSignature
     * @constructor
     * @param Object.pki: Object pki is required only for tests.
     * @param Object.store: Vuex Store.
     */
    constructor({ pki, store }) {
        this.store = store
        if (pki) {
            this.pki = pki
        } else {
            this.pki = new LacunaWebPki(this.store.state.loki.flowbee.license)
        }
    }

    /**
     * Start web-pki and return true if installed or return false case not installed.
     * If false call redirectToInstallWebPki
     * @return {void}
     */
    async loadWebPki() {
        return new Promise((resolve, reject) => {
            this.pki.init({
                ready: () => resolve(true),
                notInstalled: () => resolve(false),
                defaultError: message => reject(message)
            })
        })
    }

    /**
     * List all available certificates in your chrome plugin.
     * @return Array
     */
    async listCertificates() {
        return new Promise((resolve, reject) => {
            this.pki
                .listCertificates()
                .success(certificates => {
                    const formatedCertificates = this._formatCertificatesTitles(certificates)
                    resolve(formatedCertificates)
                })
                .error(error => reject(error))
        })
    }

    /**
     * Sign document
     * @param {String} certificateThumbPrint
     * @param {String} documentId
     * @return {void}
     */
    async sign(certificateThumbPrint, documentId) {
        const certificateContent = await this._readCertificate(certificateThumbPrint)

        const paramsToSign = await this._preprareDocumentToSign(certificateContent, documentId)

        const signHash = await this._sign({
            thumbprint: certificateThumbPrint,
            hash: paramsToSign.hashParaAssinar,
            algoritmo: paramsToSign.algoritmoHash
        })

        await this._finishSign(documentId, signHash, paramsToSign)
    }

    /**
     * Redirect to web-pki installation page
     * @return {void}
     */
    redirectToInstallWebPki() {
        this.pki.redirectToInstallPage()
    }

    async _finishSign(documentId, signHash, paramsToSign) {
        await this.store.dispatch(actionTypes.SIGNATURE.DIGITAL.FINISH, {
            documentId: documentId,
            signHash: signHash,
            temporarySubscription: paramsToSign.assinaturaTemporariaId
        })
    }

    async _preprareDocumentToSign(certificateContent, documentId) {
        return this.store.dispatch(actionTypes.SIGNATURE.DIGITAL.START, {
            certificadoConteudo: certificateContent,
            documentId: documentId
        })
    }

    async _readCertificate(thumbprint) {
        return new Promise((resolve, reject) => {
            this.pki
                .readCertificate(thumbprint)
                .success(informacoesPublicas => resolve(informacoesPublicas))
                .error(error => reject(error))
        })
    }

    async _sign({ thumbprint, hash, algoritmo }) {
        return new Promise((resolve, reject) => {
            this.pki
                .signHash({
                    thumbprint,
                    hash,
                    digestAlgorithm: algoritmo
                })
                .success(hashAssinatura => resolve(hashAssinatura))
                .error(error => reject(error))
        })
    }

    _formatCertificatesTitles(certificados) {
        certificados.forEach(certificado => {
            if (new Date() > certificado.validityEnd) {
                certificado.prettyName = `[EXPIRADO] ${certificado.subjectName} (emitido por ${certificado.issuerName})`
            } else {
                certificado.prettyName = `${certificado.subjectName} (emitido por ${certificado.issuerName})`
            }
        })
        return certificados
    }
}