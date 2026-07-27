class Solution {
    public int[] solution(int[] array) {
        int max = Integer.MIN_VALUE; 
        int cnt = 0; 
        for (int i = 0; i < array.length; i++){
            if (array[i] > max){
                max = array[i];
                cnt = i;  
            }
        
            
        }
        return new int[] {max, cnt};
    }
}