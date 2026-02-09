import styled from 'vue3-styled-components'

export const SC_PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
`

export const SC_PostAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;

  a {
    border: 0;
  }
`

export const SC_PostAuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_PostAuthorName = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(33, 37, 41);
`

export const SC_PostAuthorRep = styled.div`
  color: rgb(108, 117, 125);
  border: 1px solid rgb(222, 226, 230);
  border-radius: 6px;
  padding: 0 6px;
  line-height: 1.4;
  font-weight: 500;
  font-size: 14px;
`

export const SC_PostTime = styled.time`
  font-size: 11px;
  color: rgb(108, 117, 125);
  margin-top: 2px;
`

export const SC_AuthorNameRow = styled.div`
  display: flex;
  align-items: center;
  text-decoration: none;
  gap: 8px;

  a {
    border-bottom: 0;
  }
`

export const SC_ChatBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    color: #00a4ff;
    background: rgba(0, 164, 255, 0.08);
  }
`

export const SC_PostBookmark = styled.div`
  margin-left: auto;
  cursor: pointer;
  padding: 0 10px;
`

export const SC_AuthorLinkWrap = styled.div`
  display: block;
`
