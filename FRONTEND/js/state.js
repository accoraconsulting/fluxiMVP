export const kycState = {
   // =========================
  // CONTROL DEL WIZARD
  // =========================
  currentStep: null,            // <- backend decides
  completedSteps: [],           // <- backend confirmed

  // =========================
  // ESTADO GENERAL KYC
  // =========================
  meta: {
    kyc_id: null,               // <- CLAVE
    status: 'not_started',      // source of truth
    lastSavedAt: null,
    submitting: false
  },
  
  // =========================
  // DATOS PERSONALES
  // =========================
  personal: {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    nationality: '',
    country: '',
    document_type: '',
    document_number: '',
    document_expiration_date: '',
    email: '',
    phone: '',
    country_code: ''
  },

  // =========================
  // DOCUMENTOS PERSONALES
  // =========================
  documents: [
    /*
    {
      document_type_id,
      file,
      previewUrl,
      uploaded: false
    }
    */
  ],

  // =========================
  // SELFIE BIOMÉTRICO
  // =========================
  selfie: {
    file: null,
    previewUrl: null,
    uploaded: false
  },

  // =========================
  // EMPRESA
  // =========================
  company: {
    legal_name: '',
    trade_name: '',
    incorporation_country: '',
    incorporation_date: '',
    tax_id: '',
    tax_id_type: '',
    tax_country: '',
    commercial_registry: '',
    economic_activity: '',
    industry_code: '',
    business_address: '',
    city: '',
    country: '',
    country_code: '',
    postal_code: '',
    corporate_email: '',
    corporate_phone: '',
    operating_currency: '',
    monthly_tx_volume: ''
  },

  // =========================
  // DOCUMENTOS DE EMPRESA
  // =========================
  companyDocuments: [
    /*
    {
      document_type_id,
      file,
      previewUrl,
      uploaded: false
    }
    */
  ]
};
