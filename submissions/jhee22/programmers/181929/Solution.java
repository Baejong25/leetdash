class Solution {
    public int solution(int[] num_list) {
        int result1 = 1; 
        int result2 = 0; 
        for (int i = 0; i < num_list.length; i++){
            result1 *= num_list[i]; 
            result2 += num_list[i]; 
        }
        result2 = (int) Math.pow(result2, 2); 
        if (result1 <= result2) {
            return 1; 
        }
        return 0; 
     }
}