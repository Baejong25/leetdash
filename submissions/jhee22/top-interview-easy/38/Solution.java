class Solution {
    public String countAndSay(int n) {
        String string_cnt = "1"; 

        // 바깥 반복이 n - 1 
        for (int i = 1; i < n; i++){ 
            StringBuilder sb = new StringBuilder(); 
            int cnt = 1; 

            for (int j = 1; j < string_cnt.length(); j++) {
                // 이전 인덱스와 같은 값인지 비교 비교 
    
                if (string_cnt.charAt(j-1) == string_cnt.charAt(j)) {
                    cnt++; 
                } else {
                    // 연속이 끝난 숫자를 sb에 넣은 다음에 초기화 
                    sb.append(cnt); 
                    sb.append(string_cnt.charAt(j-1)); 
                    cnt = 1; 
                } 

            }
            // 마지막 묶음 처리 
            sb.append(cnt); 
            sb.append(string_cnt.charAt(string_cnt.length() - 1));


            string_cnt = sb.toString(); 
            System.out.println(string_cnt); 


        }

        
        return string_cnt; 
    }
}