declare module '@/b-components/sidebar/dummy-data/filters-data' {
  export const filtersData: {
    timeFilters: Array<{ id: string | number; active: boolean; name: string }>;
    sortFilters: Array<{ id: string | number; active: boolean; name: string }>;
  };
}

declare module '@/b-components/sidebar/dummy-data/tabs-data' {
  export const tabsData: Array<{ id: number; active: boolean; name: string }>;
}

declare module '@/b-components/sidebar/dummy-data/footer-data' {
  export const footerData: any;
}

declare module '@/b-components/sidebar/dummy-data/tags-data' {
  export const tagsData: any;
}
