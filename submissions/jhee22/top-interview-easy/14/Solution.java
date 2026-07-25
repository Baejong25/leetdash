class Solution {
    public String longestCommonPrefix(String[] strs) {
        StringBuilder sb = new StringBuilder(); 
        int minCnt = Integer.MAX_VALUE; 

        for (int i = 0; i < strs.length; i++){
            // 기준 반복 횟수 
            if (minCnt >=  strs[i].length()) {
                minCnt = strs[i].length(); 
            }

        } 
        // 첫 번째 글자를 기준으로 
        for (int i = 0; i < minCnt; i++) {
            char term = strs[0].charAt(i); 
            
            for (int j = 1; j < strs.length; j++){
                if (term != strs[j].charAt(i)){
                   return sb.toString(); 
                }
            }
            // 모든 문자가 같다는 걸 확인 후 append 
            sb.append(term); 
            
        }
            
        return sb.toString();     
    }
}