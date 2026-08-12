/*
    현재 단어에서 A, E, I, O, U 붙여보고 
    문자열의 길이가 5가 넘어가면 더 이상의 재귀 호출을 멈춤 

*/
class Solution {
    int cnt = 0; 
    public int dfs(String curr, String[] wordList, String word) {
        // wordList 안을 순회 
        for (String w : wordList) {
            // 새 단어 생성, 카운트 증가 
            String newWord = curr + w; 
            cnt++;   
            
            // 조건 확인 
            if (newWord.equals(word)) {
                return cnt; 
            }
            if (newWord.length() < 5) {
                int result = dfs(newWord, wordList, word);     
                if (result > 0) return result;
            }
            
        } 
        // 못 찾은 경우 
        return -1; 
    }
    public int solution(String word) {
        String curr = ""; 
        String[] wordList = {"A", "E", "I", "O", "U"}; 
        cnt = dfs(curr, wordList, word); 
        return cnt; 
    }
}