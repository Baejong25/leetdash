class Solution {
    public int solution(int n) {
        int total = 0; 
        if (n % 2 == 0){
            for (int i = 1; i < n+1; i++){
                if (i % 2 ==0 ){
                    total += i * i;  
                }
            }
            return total; 
        } 
        for (int i = 1; i < n+1; i++){
            if (i % 2 == 1){
                total += i;
            }
        }

        return total; 
    }
}