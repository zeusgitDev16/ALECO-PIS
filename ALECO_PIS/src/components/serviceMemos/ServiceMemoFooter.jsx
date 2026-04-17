import React from 'react';
import '../../CSS/ServiceMemos.css';

const ServiceMemoFooter = () => {
  return (
    <div className="service-memo-footer">
      <button type="button" className="service-memos-btn service-memos-btn--draft">
        Draft
      </button>
      <button type="button" className="service-memos-btn service-memos-btn--save">
        Save
      </button>
      <button type="button" className="service-memos-btn service-memos-btn--print">
        Print
      </button>
    </div>
  );
};

export default ServiceMemoFooter;
